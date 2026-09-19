package cl.tecnologicachile.muxterm;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.media.ToneGenerator;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Bundle;
import android.os.Vibrator;
import android.view.Gravity;
import android.view.KeyEvent;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Proof of concept: does a native media session receive the headset button
 * with the screen off, where the browser never did?
 *
 * Nothing else lives here on purpose. If this does not register presses there
 * is no point building the rest, and if it does the remainder is plumbing.
 *
 * There is no adb link to the phone, so the evidence has to be visible and
 * audible on the device itself: an on-screen counter, a beep and a buzz.
 */
public class MainActivity extends Activity {

    private MediaSession session;
    private AudioTrack track;
    private AudioFocusRequest focus;
    private String audio = "sin audio";
    private TextView status;
    private int presses = 0;
    private String last = "—";

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(Color.BLACK);
        root.setPadding(40, 40, 40, 40);

        status = new TextView(this);
        status.setTextColor(Color.GREEN);
        status.setTextSize(20);
        status.setGravity(Gravity.CENTER);
        root.addView(status);

        setContentView(root);

        session = new MediaSession(this, "muxterm-poc");
        session.setCallback(new MediaSession.Callback() {
            @Override
            public boolean onMediaButtonEvent(Intent intent) {
                KeyEvent ev = intent.getParcelableExtra(Intent.EXTRA_KEY_EVENT);
                if (ev != null && ev.getAction() == KeyEvent.ACTION_DOWN) {
                    record("tecla " + KeyEvent.keyCodeToString(ev.getKeyCode()));
                }
                return true;
            }
            @Override public void onPlay()  { record("onPlay"); }
            @Override public void onPause() { record("onPause"); }
            @Override public void onSkipToNext() { record("onSkipToNext"); }
            @Override public void onSkipToPrevious() { record("onSkipToPrevious"); }
        });

        // A session only receives buttons while it is active and claims to be
        // playing, which is why the state is declared before activating it.
        session.setPlaybackState(new PlaybackState.Builder()
                .setActions(PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE
                        | PlaybackState.ACTION_PLAY_PAUSE
                        | PlaybackState.ACTION_SKIP_TO_NEXT
                        | PlaybackState.ACTION_SKIP_TO_PREVIOUS)
                .setState(PlaybackState.STATE_PLAYING, 0, 1.0f)
                .build());
        session.setActive(true);

        // Since Android 8 the media button goes to whichever app last played
        // audio — YouTube got it because it sounds. The first version of this
        // test never played anything, so it never became a candidate. Now it
        // holds audio focus and loops near-silence, the way a real player would.
        startAudio();

        render();
    }

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
                        @Override public void onAudioFocusChange(int change) {
                            audio = "foco: " + change;
                            runOnUiThread(new Runnable() { @Override public void run() { render(); } });
                        }
                    })
                    .build();
            int granted = am.requestAudioFocus(focus);

            int rate = 8000;
            short[] samples = new short[rate];              // one second
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
            audio = "reproduciendo (foco " + (granted == AudioManager.AUDIOFOCUS_REQUEST_GRANTED ? "concedido" : "denegado") + ")";
        } catch (Exception e) {
            audio = "audio falló: " + e.getMessage();
        }
    }

    /** Feedback has to reach you with the screen off, so: sound and vibration. */
    private void record(String what) {
        presses++;
        last = what + "  ·  " + new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(new Date());
        // A plain Runnable, not a method reference: lambdas need a JDK class
        // that android.jar does not carry when compiling against it directly.
        runOnUiThread(new Runnable() {
            @Override public void run() { render(); }
        });
        try {
            new ToneGenerator(AudioManager.STREAM_MUSIC, 80)
                    .startTone(ToneGenerator.TONE_PROP_BEEP, 200);
        } catch (Exception ignored) { }
        try {
            Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (v != null) v.vibrate(150);
        } catch (Exception ignored) { }
    }

    private void render() {
        status.setText("muxterm — prueba de botón\n\n"
                + audio + "\n\n"
                + "Pulsaciones recibidas\n\n"
                + presses + "\n\n"
                + last + "\n\n"
                + (presses == 0
                    ? "Apaga la pantalla y pulsa el botón\ndel auricular."
                    : "Funciona. Cada pulsación suma,\nsuena y vibra."));
    }

    @Override
    protected void onDestroy() {
        // Kept playing through onPause/onStop on purpose: the screen going off
        // is the whole point of the test.
        if (track != null) { try { track.stop(); track.release(); } catch (Exception ignored) { } }
        if (focus != null) {
            try { ((AudioManager) getSystemService(AUDIO_SERVICE)).abandonAudioFocusRequest(focus); } catch (Exception ignored) { }
        }
        if (session != null) { session.setActive(false); session.release(); }
        super.onDestroy();
    }
}
