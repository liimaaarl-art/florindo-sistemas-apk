from pathlib import Path

root=Path('android/app/src/main/java/com/florindosistemas/central')
root.mkdir(parents=True,exist_ok=True)
main=root/'MainActivity.java'
plugin=root/'VoiceRecorderPlugin.java'

main.write_text('''package com.florindosistemas.central;\n\nimport android.os.Bundle;\nimport com.getcapacitor.BridgeActivity;\n\npublic class MainActivity extends BridgeActivity {\n    @Override\n    public void onCreate(Bundle savedInstanceState) {\n        registerPlugin(VoiceRecorderPlugin.class);\n        super.onCreate(savedInstanceState);\n    }\n}\n''',encoding='utf-8')

plugin.write_text(r'''package com.florindosistemas.central;

import android.Manifest;
import android.media.MediaRecorder;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;

@CapacitorPlugin(
    name = "FlorindoVoiceRecorder",
    permissions = { @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }) }
)
public class VoiceRecorderPlugin extends Plugin {
    private MediaRecorder recorder;
    private File outputFile;

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphonePermissionCallback");
            return;
        }
        startRecording(call);
    }

    @PermissionCallback
    private void microphonePermissionCallback(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            startRecording(call);
        } else {
            call.reject("Permissão do microfone negada.");
        }
    }

    private void startRecording(PluginCall call) {
        if (recorder != null) {
            call.reject("Já existe uma gravação em andamento.");
            return;
        }
        try {
            outputFile = new File(getContext().getCacheDir(), "florindo-voice-" + System.currentTimeMillis() + ".m4a");
            recorder = new MediaRecorder();
            recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            recorder.setAudioEncodingBitRate(96000);
            recorder.setAudioSamplingRate(44100);
            recorder.setOutputFile(outputFile.getAbsolutePath());
            recorder.prepare();
            recorder.start();
            JSObject result = new JSObject();
            result.put("recording", true);
            call.resolve(result);
        } catch (Exception e) {
            releaseRecorder();
            deleteOutput();
            call.reject("Não foi possível iniciar o microfone.", e);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (recorder == null || outputFile == null) {
            call.reject("Nenhuma gravação em andamento.");
            return;
        }
        try {
            recorder.stop();
            releaseRecorder();
            byte[] bytes = readAll(outputFile);
            if (bytes.length == 0) throw new IllegalStateException("Áudio vazio");
            JSObject result = new JSObject();
            result.put("base64", Base64.encodeToString(bytes, Base64.NO_WRAP));
            result.put("mimeType", "audio/mp4");
            result.put("size", bytes.length);
            deleteOutput();
            call.resolve(result);
        } catch (Exception e) {
            releaseRecorder();
            deleteOutput();
            call.reject("Não foi possível finalizar a gravação.", e);
        }
    }

    private byte[] readAll(File file) throws Exception {
        try (FileInputStream in = new FileInputStream(file); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int n;
            while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
            return out.toByteArray();
        }
    }

    private void releaseRecorder() {
        if (recorder != null) {
            try { recorder.reset(); } catch (Exception ignored) {}
            try { recorder.release(); } catch (Exception ignored) {}
            recorder = null;
        }
    }

    private void deleteOutput() {
        if (outputFile != null) {
            try { outputFile.delete(); } catch (Exception ignored) {}
            outputFile = null;
        }
    }
}
''',encoding='utf-8')

print('Plugin Android FlorindoVoiceRecorder criado e registrado no MainActivity.')
