import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      proxy: {
        '/api/bgg': {
          target: 'https://boardgamegeek.com',
          changeOrigin: true,
          rewrite: path => path.replace(/^\/api\/bgg/, '/xmlapi2/thing'),
          configure: proxy => {
            proxy.on('proxyReq', proxyReq => {
              if (env.BGG_API_KEY) {
                proxyReq.setHeader('Authorization', `Bearer ${env.BGG_API_KEY}`);
              }
            });
          },
        },
      },
    },
  };
});
