import type { Apartment, Building, Member, Profile } from './api';
import type { Term } from './economy';
/** Explicit public projection. Never add wallet, staff, auth or moderation data here. */
export interface ResidentPublicInfo {
  userId: string;
  username: string;
  buildingId: string;
  buildingName: string;
  apartmentNumber: number;
  floor: number;
  joinedMonth?: string;
  isManager: boolean;
}
export interface PublicApartment {
  number: number;
  status: 'empty' | 'occupied' | 'unavailable';
  resident?: ResidentPublicInfo;
}
export function avatarIdFor(userId: string): string | null {
  if (typeof userId !== 'string' || !/^[a-z0-9_-]{1,100}$/i.test(userId)) return null;
  // FNV-1a over a canonical ID; ordinal is independent of manifest/list order.
  let hash = 2166136261;
  for (const char of userId.toLowerCase()) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return 'portrait-' + String(hash % 16 + 1).padStart(2, '0');
}
export function joinedMonth(value?: string): string | undefined {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return undefined;
  return new Intl.DateTimeFormat('tr-TR', { timeZone:'Europe/Istanbul', month:'long', year:'numeric' }).format(new Date(value));
}
export function publicApartments(viewerId: string, building: Building | undefined, profiles: Profile[], members: Member[], apartments: Apartment[], terms: (Term & { building_id?: string })[], now = Date.now()): PublicApartment[] {
  // Require both the viewer's membership and a matching building. Never trust URL IDs.
  if (!building || typeof building.name !== 'string' || !building.name.trim() || !members.some(m => m.user_id === viewerId && m.building_id === building.id)) return [];
  const activeManager = terms.find(t => t.building_id === building.id && !t.voided && Date.parse(t.starts_at) <= now && Date.parse(t.ends_at) > now)?.user_id;
  return Array.from({length:12}, (_,i) => {
    const number = i + 1;
    const apartment = apartments.find(a => a.building_id === building.id && a.number === number);
    if (!apartment) return {number, status:'unavailable'};
    const member = members.find(m => m.building_id === building.id && m.apartment_id === apartment.id);
    if (!member) return {number, status:'empty'};
    const profile = profiles.find(p => p.id === member.user_id);
    if (!profile || typeof profile.username !== 'string' || !profile.username.trim()) return {number, status:'unavailable'};
    return {number, status:'occupied', resident:{
      userId:profile.id, username:profile.username, buildingId:building.id, buildingName:building.name,
      apartmentNumber:number, floor:Math.ceil(number/3), joinedMonth:joinedMonth(member.joined_at), isManager:profile.id === activeManager,
    }};
  });
}
