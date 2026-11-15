import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;
export interface Profile {
  id: string;
  username: string;
}
export interface Member {
  user_id: string;
  building_id: string;
  apartment_id: string;
}
export interface Apartment {
  id: string;
  number: number;
}
export interface Building {
  id: string;
  name: string;
  treasury: number;
}
export interface Message {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
}
export interface Poll {
  id: string;
  event_id: string;
  ends_at: string;
  status: "open" | "accepted" | "rejected";
  yes_count: number;
  no_count: number;
}
export interface GameEvent {
  id: string;
  title: string;
  description: string;
  cost: number;
}
export interface Activity {
  id: string;
  description: string;
  created_at: string;
}
export interface Announcement {
  id: string;
  title: string;
  body: string;
}
export interface Vote {
  poll_id: string;
  choice: boolean;
}
export interface Block {
  blocked_id: string;
}
export interface Transaction {
  id: string;
  amount: number;
  created_at: string;
}
export function errorText(error: unknown): string {
  const msg =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : String(error);
  if (/Invalid login credentials/i.test(msg))
    return "E-posta veya şifre yanlış.";
  if (/Email not confirmed/i.test(msg))
    return "Giriş için e-postanızdaki doğrulama bağlantısını açın.";
  if (/already registered/i.test(msg))
    return "Bu e-posta ile bir hesap zaten var.";
  if (/rate limit|too many requests|over_email_send_rate_limit/i.test(msg))
    return "Çok fazla deneme yapıldı. Bir süre sonra yeniden deneyin.";
  if (
    /profiles_username_unique|Database error saving new user|duplicate key/i.test(
      msg,
    )
  )
    return "Kullanıcı adı kullanılıyor veya işlem zaten kaydedilmiş. Başka bir ad deneyin.";
  if (/Failed to fetch|NetworkError|fetch failed/i.test(msg))
    return "Sunucuya ulaşılamadı. Bağlantınızı kontrol edin.";
  if (/password/i.test(msg)) return "Şifre en az 8 karakter olmalı.";
  if (/email.*invalid|invalid.*email/i.test(msg))
    return "Geçerli bir e-posta adresi yazın.";
  if (/[ığüşöçİĞÜŞÖÇ]/.test(msg)) return msg;
  return "İşlem tamamlanamadı. Lütfen tekrar deneyin.";
}
export const money = (n: number) => new Intl.NumberFormat("tr-TR").format(n);
export const time = (s: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(s));
