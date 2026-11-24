import { useState } from 'react';
import { avatars } from 'virtual:apartman-art-catalog';
import { avatarIdFor } from '../social';
export function Avatar({ userId, name, size = 40 }: { userId?: string; name: string; size?: number }) {
  const id = avatarIdFor(userId || '');
  const file = avatars.find(a => a.id === id)?.file;
  const src = file ? import.meta.env.BASE_URL + 'art/v2/avatars/' + file : undefined;
  const [failed, setFailed] = useState<string>();
  return <span className="resident-avatar" role="img" aria-label={name + ' avatarı'} style={{width:size,height:size}}>
    {src && src !== failed ? <img src={src} alt="" width={size} height={size} onError={() => setFailed(src)} /> : <span aria-hidden="true">{name.trim().slice(0,1).toLocaleUpperCase('tr-TR') || '?'}</span>}
  </span>;
}
