package cl.tecnologicachile.muxterm;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.media.MediaRecorder;
import android.media.ToneGenerator;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.view.KeyEvent;

import java.io.File;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Hands-free dictation from a headset button, screen off.
 *
 * What the proof of concept established: a native media session that holds
 * audio focus and is actually playing receives the button where the browser
 * never did. This service keeps exactly that alive in the foreground, and on a
 * press records natively, sends the audio to muxterm's transcription endpoint
 * and drops the text into the terminal as a prompt. Nothing here goes through
 * the WebView, which would land back on the rule that blocked capture there.
 *
 * With the screen off, tones are the only feedback there is.
 */
public class HandsFreeService extends Service {

    static final String ACTION_STOP = "cl.tecnologicachile.muxterm.STOP";
    static final String PREFS = "muxterm";
    private static final String CHANNEL = "handsfree";
    private static final int NOTIF_ID = 1;

    /** Last status line, for the activity to show; null when not running. */
    static volatile String status = null;

    private MediaSession session;
    private AudioTrack track;
    private AudioFocusRequest focus;
    private MediaRecorder recorder;
    private File recFile;
    private boolean recording = false;
    private boolean busy = false;
    private long lastPress = 0;
    private long recStart = 0;
    private PowerManager.WakeLock wake;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService io = Executors.newSingleThreadExecutor();

    @Override
    public void onCreate() {
        super.onCreate();
        status = "iniciando";
        createChannel();
        foreground("Manos libres listo — pulsa el auricular para dictar", false);

        session = new MediaSession(this, "muxterm");
        session.setCallback(new MediaSession.Callback() {
            @Override
            public boolean onMediaButtonEvent(Intent intent) {
                KeyEvent ev = intent.getParcelableExtra(Intent.EXTRA_KEY_EVENT);
                // Only the initial press: a held button repeats ACTION_DOWN
                // many times a second, which toggled record/stop in a chain
                // and sent Whisper a burst of unplayable millisecond files.
                if (ev != null && ev.getAction() == KeyEvent.ACTION_DOWN && ev.getRepeatCount() == 0) press();
                return true;
            }
            // Some stacks translate the key before it reaches us; treat those
            // the same, but they never arrive alongside the raw event.
            @Override public void onPlay()  { }
            @Override public void onPause() { }
            @Override public void onSkipToNext() { press(); }
        });
        session.setPlaybackState(new PlaybackState.Builder()
                .setActions(PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE
                        | PlaybackState.ACTION_PLAY_PAUSE | PlaybackState.ACTION_SKIP_TO_NEXT)
                .setState(PlaybackState.STATE_PLAYING, 0, 1.0f)
                .build());
        session.setActive(true);

        startAudio();
        status = "listo";
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    // ---- the keep-alive that earns us the button ----

    private void startAudio() {
        try {
            AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build();
            AudioManager am = (AudioManager) getSystemService(AUDIO_SERVICE);
            focus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setAudioAttributes(attrs)
                    .setOnAudioFocusChangeListener(new AudioManager.OnAudioFocusChangeListener() {
                        @Override public void onAudioFocusChange(int change) { }
                    })
                    .build();
            am.requestAudioFocus(focus);

            int rate = 8000;
            short[] samples = new short[rate];
            for (int i = 0; i < samples.length; i++) samples[i] = (short) ((i % 2 == 0) ? 1 : -1);
            int min = AudioTrack.getMinBufferSize(rate, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT);
            track = new AudioTrack(attrs,
                    new AudioFormat.Builder().setSampleRate(rate)
                            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build(),
                    Math.max(min, samples.length * 2), AudioTrack.MODE_STATIC,
                    AudioManager.AUDIO_SESSION_ID_GENERATE);
            track.write(samples, 0, samples.length);
            track.setLoopPoints(0, samples.length, -1);
            track.play();
        } catch (Exception e) {
            status = "audio falló: " + e.getMessage();
        }
    }

    // ---- press → record → send ----

    /** One press per intent: headsets and stacks often deliver a key twice. */
    private void press() {
        long now = SystemClock.elapsedRealtime();
        if (now - lastPress < 800) return;
        lastPress = now;
        toggle();
    }

    private void toggle() {
        if (busy) { tone(ToneGenerator.TONE_PROP_NACK); return; }
        if (recording) stopAndSend(); else startRecording();
    }

    private void startRecording() {
        SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
        if (p.getString("token", "").isEmpty() || p.getString("terminalId", "").isEmpty()) {
            // The web side has not told us where to send yet.
            status = "sin sesión: abre un panel en modo conversación";
            updateNotification("Abre un panel en modo conversación", false);
            tone(ToneGenerator.TONE_PROP_NACK);
            return;
        }
        try {
            // Android 14 wants the microphone type declared while the mic is
            // in use, on top of the media playback type we already hold.
            foreground("Grabando… pulsa de nuevo para enviar", true);
            wakeOn();
            recFile = new File(getCacheDir(), "dictado.m4a");
            recorder = new MediaRecorder();
            recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            recorder.setAudioSamplingRate(16000);
            recorder.setAudioEncodingBitRate(48000);
            recorder.setOutputFile(recFile.getAbsolutePath());
            recorder.prepare();
            recorder.start();
            recStart = SystemClock.elapsedRealtime();
            recording = true;
            status = "grabando";
            tone(ToneGenerator.TONE_PROP_BEEP);
        } catch (Exception e) {
            recording = false;
            releaseRecorder();
            wakeOff();
            status = "no se pudo grabar: " + e.getMessage();
            foreground("No se pudo abrir el micrófono", false);
            tone(ToneGenerator.TONE_PROP_NACK);
        }
    }

    private void stopAndSend() {
        recording = false;
        // Under a second of audio is a mis-press, not a dictation, and the
        // container is often not even finalised yet. Drop it and say so.
        if (SystemClock.elapsedRealtime() - recStart < 1000) {
            try { recorder.stop(); } catch (Exception ignored) { }
            releaseRecorder();
            wakeOff();
            if (recFile != null) recFile.delete();
            status = "grabación demasiado corta, descartada";
            updateNotification("Demasiado corto — pulsa, habla, y vuelve a pulsar", false);
            tone(ToneGenerator.TONE_PROP_NACK);
            return;
        }
        try { recorder.stop(); } catch (Exception e) { releaseRecorder(); wakeOff(); status = "grabación vacía"; tone(ToneGenerator.TONE_PROP_NACK); foreground("Grabación vacía", false); return; }
        releaseRecorder();
        tone(ToneGenerator.TONE_PROP_ACK);        // heard you; now working
        busy = true;
        status = "transcribiendo";
        foreground("Transcribiendo…", false);

        final SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
        final String base = p.getString("baseUrl", "");
        final String token = p.getString("token", "");
        final String terminal = p.getString("terminalId", "");
        final File file = recFile;

        io.execute(new Runnable() {
            @Override public void run() {
                String result;
                boolean ok;
                try {
                    String text = Api.transcribe(base, token, file);
                    Api.send(base, token, terminal, text);
                    result = "Enviado: " + (text.length() > 60 ? text.substring(0, 60) + "…" : text);
                    ok = true;
                } catch (Exception e) {
                    result = "Falló: " + e.getMessage();
                    ok = false;
                }
                final String r = result;
                final boolean good = ok;
                main.post(new Runnable() {
                    @Override public void run() {
                        busy = false;
                        status = r;
                        foreground(r, false);
                        tone(good ? ToneGenerator.TONE_PROP_BEEP2 : ToneGenerator.TONE_PROP_NACK);
                        wakeOff();
                        if (file != null) file.delete();
                        // Back to the resting message after a while.
                        main.postDelayed(new Runnable() {
                            @Override public void run() {
                                if (!recording && !busy) updateNotification("Manos libres listo — pulsa el auricular para dictar", false);
                            }
                        }, 8000);
                    }
                });
            }
        });
    }

    private void releaseRecorder() {
        if (recorder != null) { try { recorder.release(); } catch (Exception ignored) { } recorder = null; }
    }

    // ---- plumbing ----

    private void tone(int which) {
        try { new ToneGenerator(AudioManager.STREAM_MUSIC, 90).startTone(which, 220); }
        catch (Exception ignored) { }
    }

    private void wakeOn() {
        try {
            if (wake == null) {
                PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
                wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "muxterm:dictado");
            }
            if (!wake.isHeld()) wake.acquire(5 * 60 * 1000L);
        } catch (Exception ignored) { }
    }

    private void wakeOff() {
        try { if (wake != null && wake.isHeld()) wake.release(); } catch (Exception ignored) { }
    }

    private void createChannel() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Manos libres", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("Dictado con el botón del auricular");
        nm.createNotificationChannel(ch);
    }

    private Notification build(String text) {
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE);
        Intent stop = new Intent(this, HandsFreeService.class).setAction(ACTION_STOP);
        PendingIntent stopPi = PendingIntent.getService(this, 1, stop, PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                .setContentTitle("muxterm — manos libres")
                .setContentText(text)
                .setContentIntent(pi)
                .setOngoing(true)
                .addAction(new Notification.Action.Builder(null, "Detener", stopPi).build())
                .build();
    }

    /** startForeground, with the service types Android 10+/14 insist on. */
    private void foreground(String text, boolean mic) {
        Notification n = build(text);
        if (Build.VERSION.SDK_INT >= 29) {
            int type = ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK;
            if (mic && Build.VERSION.SDK_INT >= 30) type |= ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
            startForeground(NOTIF_ID, n, type);
        } else {
            startForeground(NOTIF_ID, n);
        }
    }

    private void updateNotification(String text, boolean mic) {
        ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).notify(NOTIF_ID, build(text));
    }

    @Override
    public void onDestroy() {
        status = null;
        if (recording) { try { recorder.stop(); } catch (Exception ignored) { } }
        releaseRecorder();
        wakeOff();
        if (track != null) { try { track.stop(); track.release(); } catch (Exception ignored) { } }
        if (focus != null) {
            try { ((AudioManager) getSystemService(AUDIO_SERVICE)).abandonAudioFocusRequest(focus); } catch (Exception ignored) { }
        }
        if (session != null) { session.setActive(false); session.release(); }
        io.shutdownNow();
        super.onDestroy();
    }

    static void start(Context ctx) {
        Intent i = new Intent(ctx, HandsFreeService.class);
        if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i); else ctx.startService(i);
    }
}
