package cl.tecnologicachile.muxterm;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.media.AudioManager;
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

        render();
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
                + "Pulsaciones recibidas\n\n"
                + presses + "\n\n"
                + last + "\n\n"
                + (presses == 0
                    ? "Apaga la pantalla y pulsa el botón\ndel auricular."
                    : "Funciona. Cada pulsación suma,\nsuena y vibra."));
    }

    @Override
    protected void onDestroy() {
        if (session != null) { session.setActive(false); session.release(); }
        super.onDestroy();
    }
}
