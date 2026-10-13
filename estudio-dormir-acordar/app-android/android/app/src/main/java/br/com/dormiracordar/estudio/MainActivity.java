package br.com.dormiracordar.estudio;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // tela inteira: o estúdio usa env(safe-area-inset-*) para não ficar embaixo da barra de status
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
    }
}
