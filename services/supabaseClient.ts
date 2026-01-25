
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tlsrwljgftqwpvdsvnnz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsc3J3bGpnZnRxd3B2ZHN2bm56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNDU5NzksImV4cCI6MjA4NDkyMTk3OX0.A75qGp5Dj4HHSIMeSVGSqAzQ7U2LDMfhg-5Ev3S-yJA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
