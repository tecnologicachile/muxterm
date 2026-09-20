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
    private TextView fallback;
    private final Handler ui = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.BLACK);

        // A WebView has no address bar, so a page that fails to load needs a
        // way back that is not killing the app. Hidden until that happens.
        fallback = new TextView(this);
        fallback.setTextColor(0xFFDDDDDD);
        fallback.setBackgroundColor(0xFF111111);
        fallback.setTextSize(14);
        fallback.setPadding(32, 24, 32, 24);
        fallback.setGravity(android.view.Gravity.CENTER);
        fallback.setVisibility(android.view.View.GONE);
        fallback.setOnClickListener(new android.view.View.OnClickListener() {
            @Override public void onClick(android.view.View v) { if (web != null) web.reload(); }
        });
        root.addView(fallback);

        web = new WebView(this);
        root.addView(web, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // the page keeps its token in localStorage
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.setWebViewClient(new WebViewClient() {
            @Override public void onPageStarted(WebView v, String url, android.graphics.Bitmap favicon) {
                fallback.setVisibility(android.view.View.GONE);
            }
            @Override public void onReceivedError(WebView v, int code, String desc, String failingUrl) {
                if (failingUrl != null && failingUrl.equals(v.getUrl())) showFallback(desc);
            }
            @Override public void onReceivedSslError(WebView v, android.webkit.SslErrorHandler h, android.net.http.SslError err) {
                h.cancel();
                showFallback("certificado no válido (" + err.getPrimaryError() + ")");
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                // Grant on the spot — deferring it is one of the ways the page
                // ends up seeing a denial. The page inside the app normally
                // records natively instead, so this is a fallback.
                boolean mic = checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
                if (mic) request.grant(request.getResources()); else request.deny();
                if (!mic) android.widget.Toast.makeText(MainActivity.this, "Sin permiso de micrófono", android.widget.Toast.LENGTH_SHORT).show();
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
        else android.widget.Toast.makeText(this, "Sin permiso de micrófono: el manos libres no puede grabar", android.widget.Toast.LENGTH_LONG).show();
    }

    private final Runnable refresh = new Runnable() {
        @Override public void run() {
            String st = HandsFreeService.status;
            // Let the page paint the recording state on its own mic button, the
            // way it does when it records itself in a browser.
            if (web != null) {
                web.evaluateJavascript("window.muxtermNativeState&&window.muxtermNativeState({recording:"
                        + HandsFreeService.recordingNow + ",status:" + org.json.JSONObject.quote(st == null ? "detenido" : st) + "})", null);
            }
            ui.postDelayed(this, 1000);
        }
    };

    private void showFallback(String why) {
        fallback.setText("No se pudo cargar muxterm" + (why == null || why.isEmpty() ? "" : ": " + why) + "\n\nToca para reintentar");
        fallback.setVisibility(android.view.View.VISIBLE);
    }

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
