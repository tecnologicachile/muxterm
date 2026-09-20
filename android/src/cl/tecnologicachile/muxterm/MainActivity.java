package cl.tecnologicachile.muxterm;

import android.Manifest;
import android.app.Activity;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;

/**
 * muxterm in a WebView, with the hands-free service underneath.
 *
 * The WebView is only the screen. Everything that has to survive the screen
 * going off — the media session, the recording, the upload — lives in
 * HandsFreeService, which the page feeds through a small bridge: the auth
 * token and which terminal is open in modo conversación.
 */
public class MainActivity extends Activity {

    private static final String DEFAULT_URL = "https://muxterm-gquiero:3002/workspace";
    private static final int REQ_PERMS = 7;

    private WebView web;
    private TextView strip;
    private final Handler ui = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.BLACK);

        // One line of native status above the page. It is how a problem in the
        // service becomes visible without a debugger attached to the phone.
        strip = new TextView(this);
        strip.setTextColor(0xFF00AA55);
        strip.setBackgroundColor(0xFF111111);
        strip.setTextSize(11);
        strip.setPadding(16, 6, 16, 6);
        strip.setText("manos libres: iniciando");
        // A WebView has no address bar: without this, a page that got stuck
        // could only be recovered by killing the app.
        strip.setOnClickListener(new android.view.View.OnClickListener() {
            @Override public void onClick(android.view.View v) { if (web != null) web.reload(); }
        });
        root.addView(strip);

        web = new WebView(this);
        root.addView(web, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // the page keeps its token in localStorage
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                // Grant on the spot — deferring it is one of the ways the page
                // ends up seeing a denial. The page inside the app normally
                // records natively instead, so this is a fallback.
                boolean mic = checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
                if (mic) request.grant(request.getResources()); else request.deny();
                strip.setText("página pidió micrófono: " + (mic ? "concedido" : "sin permiso RECORD_AUDIO"));
            }
        });
        web.addJavascriptInterface(new Bridge(), "muxtermNative");

        SharedPreferences p = getSharedPreferences(HandsFreeService.PREFS, MODE_PRIVATE);
        String url = p.getString("url", DEFAULT_URL);
        if (getIntent() != null && getIntent().getData() != null) {
            url = getIntent().getData().toString();
            p.edit().putString("url", url).apply();
        }
        web.loadUrl(url);

        askPermissionsThenStart();
        ui.post(refresh);
    }

    private void askPermissionsThenStart() {
        List<String> need = new ArrayList<>();
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED)
            need.add(Manifest.permission.RECORD_AUDIO);
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED)
            need.add("android.permission.POST_NOTIFICATIONS");
        if (need.isEmpty()) HandsFreeService.start(this);
        else requestPermissions(need.toArray(new String[0]), REQ_PERMS);
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        super.onRequestPermissionsResult(code, perms, results);
        if (code != REQ_PERMS) return;
        boolean mic = checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
        if (mic) HandsFreeService.start(this);
        else strip.setText("sin permiso de micrófono: el manos libres no puede grabar");
    }

    private final Runnable refresh = new Runnable() {
        @Override public void run() {
            String st = HandsFreeService.status;
            SharedPreferences p = getSharedPreferences(HandsFreeService.PREFS, MODE_PRIVATE);
            String term = p.getString("terminalId", "");
            // Let the page paint the recording state on its own mic button, the
            // way it does when it records itself in a browser.
            if (web != null) {
                web.evaluateJavascript("window.muxtermNativeState&&window.muxtermNativeState({recording:"
                        + HandsFreeService.recordingNow + ",status:" + org.json.JSONObject.quote(st == null ? "detenido" : st) + "})", null);
            }
            strip.setText("manos libres: " + (st == null ? "detenido" : st)
                    + (term.isEmpty() ? "  ·  sin panel" : "  ·  panel " + term.substring(0, Math.min(8, term.length())))
                    + "   (toca para recargar)");
            ui.postDelayed(this, 1000);
        }
    };

    /** What the page hands us. Kept to the minimum the service needs. */
    private final class Bridge {
        /** Start or stop a native dictation from the page's mic button. */
        @JavascriptInterface
        public void dictate() {
            android.content.Intent i = new android.content.Intent(MainActivity.this, HandsFreeService.class)
                    .setAction(HandsFreeService.ACTION_TOGGLE);
            startService(i);
        }

        @JavascriptInterface
        public void setContext(String token, String terminalId, String origin) {
            SharedPreferences.Editor e = getSharedPreferences(HandsFreeService.PREFS, MODE_PRIVATE).edit();
            if (token != null && !token.isEmpty()) e.putString("token", token);
            if (terminalId != null) e.putString("terminalId", terminalId);
            if (origin != null && !origin.isEmpty()) e.putString("baseUrl", origin);
            e.apply();
        }
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        ui.removeCallbacks(refresh);
        // The service outlives the activity on purpose: closing the screen
        // must not end hands-free. "Detener" in the notification does that.
        super.onDestroy();
    }
}
