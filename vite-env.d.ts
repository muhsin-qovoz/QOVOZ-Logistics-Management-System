declare var process: {
  env: {
    API_KEY: string;
    [key: string]: string | undefined;
  }
};

declare module '@supabase/supabase-js';