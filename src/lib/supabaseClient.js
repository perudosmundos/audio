import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xvfopfzdmuiyoubamotb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2Zm9wZnpkbXVpeW91YmFtb3RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyODExMzMsImV4cCI6MjA2NDg1NzEzM30.b0nq4Bujm9z5feMhqiXUWahYL0bFjRf2hkoPrutvN8o';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
