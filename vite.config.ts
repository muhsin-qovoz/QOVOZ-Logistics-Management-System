import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    define: {
      // Define process.env as an object to prevent "process is not defined" errors
      // and inject the API key safely.
      'process.env': {
        API_KEY: env.API_KEY
      }
    }
  };
});