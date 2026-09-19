package cl.tecnologicachile.muxterm;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * The two muxterm calls hands-free needs, over plain HttpURLConnection.
 *
 * No HTTP library: android.jar already has org.json, and multipart is a dozen
 * lines. The bundled root CA in the network security config is what makes the
 * self-signed muxterm certificate acceptable here.
 */
final class Api {

    private Api() { }

    /** POST /api/voice/transcribe with the recording; returns Whisper's text. */
    static String transcribe(String base, String token, File audio) throws IOException {
        String boundary = "----muxterm" + System.currentTimeMillis();
        HttpURLConnection c = open(base + "/api/voice/transcribe", token);
        c.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);

        OutputStream out = c.getOutputStream();
        write(out, "--" + boundary + "\r\n"
                + "Content-Disposition: form-data; name=\"audio\"; filename=\"audio.m4a\"\r\n"
                + "Content-Type: audio/mp4\r\n\r\n");
        InputStream in = new FileInputStream(audio);
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        in.close();
        write(out, "\r\n--" + boundary + "--\r\n");
        out.flush();
        out.close();

        JSONObject j = json(c);
        String text = j.optString("text", "").trim();
        if (text.isEmpty()) throw new IOException("Whisper no devolvió texto");
        return text;
    }

    /** POST /api/claude/send — the prompt lands in the terminal as if typed. */
    static void send(String base, String token, String terminalId, String text) throws IOException {
        HttpURLConnection c = open(base + "/api/claude/send", token);
        c.setRequestProperty("Content-Type", "application/json");
        JSONObject body = new JSONObject();
        try {
            body.put("terminalId", terminalId);
            body.put("text", text);
        } catch (Exception e) {
            throw new IOException(e);
        }
        OutputStream out = c.getOutputStream();
        out.write(body.toString().getBytes(StandardCharsets.UTF_8));
        out.close();
        json(c);
    }

    private static HttpURLConnection open(String url, String token) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setRequestMethod("POST");
        c.setDoOutput(true);
        c.setConnectTimeout(15000);
        c.setReadTimeout(60000);
        c.setRequestProperty("Authorization", "Bearer " + token);
        return c;
    }

    private static void write(OutputStream out, String s) throws IOException {
        out.write(s.getBytes(StandardCharsets.UTF_8));
    }

    /** Reads the reply and surfaces the server's own message on failure. */
    private static JSONObject json(HttpURLConnection c) throws IOException {
        int code = c.getResponseCode();
        InputStream in = code < 400 ? c.getInputStream() : c.getErrorStream();
        StringBuilder sb = new StringBuilder();
        if (in != null) {
            BufferedReader r = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
            String line;
            while ((line = r.readLine()) != null) sb.append(line);
            r.close();
        }
        JSONObject j;
        try { j = new JSONObject(sb.length() == 0 ? "{}" : sb.toString()); }
        catch (Exception e) { j = new JSONObject(); }
        if (code >= 400) {
            throw new IOException(j.optString("message", "HTTP " + code));
        }
        return j;
    }
}
