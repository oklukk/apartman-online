"""Original APARTMAN vector artwork. No stock inputs, fonts, remote assets or generators at runtime."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/art/v2'
C='#F7E8D0'; R='#EB987A'; S='#9BC5AC'; P='#315D59'; G='#D9AC65'
def svg(name,w,h,body,title):
    (OUT/name).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-labelledby="title"><title id="title">{title}</title><g stroke="{P}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">{body}</g></svg>\n')
def rect(x,y,w,h,fill,rx=0):return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}"/>'
def path(d,fill='none'):return f'<path d="{d}" fill="{fill}"/>'
def circ(x,y,r,fill):return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}"/>'
def plant(x,y,scale=1):return f'<g transform="translate({x} {y}) scale({scale})">'+path('M0 0V-40M0-15Q-35-45-25-50Q0-48 0-20M0-25Q25-65 35-50Q32-25 0-12',S)+path('M-20 0H20L15 30H-15Z',R)+'</g>'
# Logo: an apartment building with three lit windows and a conversation doorway.
mark=rect(10,12,76,80,P,18)+path('M25 35H38V48H25ZM53 35H66V48H53ZM25 60H38V73H25Z',C)+path('M53 60H76V77H65L57 85V77H53Z',G)
svg('logo-mark.svg',96,104,mark,'APARTMAN — komşuluğa açılan kapı')
svg('favicon.svg',96,104,mark,'APARTMAN')
# Facade: four residential rows and a physically separate entrance level.
b=rect(0,0,1000,1100,'#E9F1E8')
b+=circ(825,130,62,G)+path('M0 250Q130 200 240 255M755 285Q900 230 1000 260',C)
b+=path('M20 920V570L120 505L190 570V920M830 920V625L920 555L1000 625V920','#D8E5DA')
b+=rect(162,195,676,760,'#E9D6B8',8)+rect(180,185,640,770,C,6)
b+=rect(198,202,604,625,'#F2D8BD',4)
b+=path('M150 185L212 120H788L850 185Z',R)+rect(142,180,716,22,P,5)
b+=rect(690,84,44,61,R,3)+rect(680,80,64,14,C,3)
for i in range(13):b+=path(f'M{210+i*48} 127L{185+i*53} 178')
anchors=[]
for level in range(1,5):
 y=225+(4-level)*151
 b+=rect(181,y+135,638,14,C,2)
 for col in range(3):
  x=225+col*205
  b+=rect(x-9,y-7,150,120,C,6)+rect(x,y,132,104,P,4)
  b+=rect(x+5,y+5,122,93,'#A9CDD0',2)
  b+=path(f'M{x+8} {y+8}H{x+46}Q{x+54} {y+52} {x+18} {y+92}H{x+8}Z',R)
  b+=path(f'M{x+124} {y+8}H{x+93}Q{x+85} {y+52} {x+117} {y+92}H{x+124}Z',R)
  b+=path(f'M{x+66} {y}V{y+105}M{x} {y+54}H{x+132}')
  b+=rect(x-17,y+104,166,28,'#E5BC90',3)
  for k in range(7):b+=path(f'M{x-8+k*24} {y+105}V{y+132}')
  b+=path(f'M{x-18} {y+103}H{x+150}',P)
  if (level+col)%2==0:b+=plant(x+112,y+94,.42)
  else:
   b+=rect(x-6,y+111,51,18,R,3)
   for k in range(3):b+=circ(x+3+k*15,y+107,6,S)
  if level==4 and col==0:b+=path(f'M{x+49} {y+91}Q{x+40} {y+70} {x+51} {y+74}L{x+55} {y+66}L{x+61} {y+75}Q{x+74} {y+72} {x+70} {y+91}Z',G)
  anchors.append(dict(number=(level-1)*3+col+1,floor=level,column=col+1,x=x-17,y=y-7,width=166,height=139))
b+=rect(320,842,360,24,C,5) # deliberately blank nameplate
b+=rect(432,874,136,96,P,10)+rect(443,883,51,83,'#B7D3CD',3)+rect(505,883,51,83,'#B7D3CD',3)
b+=circ(487,927,3,G)+circ(512,927,3,G)+rect(410,968,180,13,'#C9B899',3)+rect(392,982,216,12,C,3)
for x in [230,690]:
 b+=rect(x,884,72,60,R,6)
 for k in range(6):b+=rect(x+6+(k%3)*21,890+(k//3)*24,15,17,C,2)
for x in [140,840]:b+=plant(x,925,1.5)
b+=path('M0 1010Q200 980 395 1010L350 1100H0ZM620 1010Q840 975 1000 1010V1100H665Z',S)
b+=path('M410 995H590L690 1100H310Z','#E9D6B8')
b+=path('M40 1045H260M740 1045H960')
for x in [55,90,125,770,805,840,875,910,945]:b+=path(f'M{x} 1035V1055')
b+=path('M42 968H148M55 968V1001M132 968V1001M46 951H144M50 938H140',G)
svg('apartment-facade.svg',1000,1100,b,'Dört konut katı, üçer balkonlu daire ve ayrı bahçe girişli apartman')
(OUT/'apartment-anchors.json').write_text(json.dumps({'viewBox':[0,0,1000,1100],'coordinateSpace':'SVG user units; scale with preserveAspectRatio xMidYMid meet','apartments':sorted(anchors,key=lambda a:a['number'])},indent=2)+'\n')
# Portraits: individual silhouettes, head shapes, hairstyles, accessories and expressions.
skins=['#EAC1A0','#BA805F','#F0CFB0','#986347','#D5A17F','#E7B99B','#B98264','#F2D3B5','#CC9472','#9F6B50','#E5BA96','#BC8968','#F1C5A0','#D6AA89','#A56E52','#E9BEA0']
hairs=['#4D3932','#2C3E3A','#755143','#38443C','#6C4D38','#423B3D','#D3C8B6','#3E3830','#614135','#343B38','#9F6545','#E2D6C3','#3D3433','#815438','#453C36','#54483E']
styles=[
 path('M57 115Q38 55 72 47Q112 20 155 57Q185 72 166 137L153 152L152 76Q112 98 65 77L65 141Z','HAIR'),
 path('M63 77Q38 68 57 51Q49 31 78 36Q87 11 111 32Q134 16 143 39Q170 35 163 59Q181 81 157 92L148 69Q100 82 63 77Z','HAIR'),
 path('M54 155V73Q56 30 111 35Q170 37 168 80V155L144 147V77Q118 81 78 68L77 150Z','HAIR'),
 path('M62 79Q58 30 111 31Q163 25 164 78L150 65Q103 58 62 79Z','HAIR')+rect(60,65,99,10,G,3),
 path('M60 88Q38 68 56 54Q47 33 75 34Q85 12 110 30Q138 20 144 44Q173 46 160 78L146 65Q100 86 60 88Z','HAIR'),
 path('M62 74Q68 30 110 35Q161 30 161 77L142 77L126 51L103 73Z','HAIR')+path('M66 124Q110 164 154 122L144 156Q107 177 77 152Z','HAIR'),
 path('M57 84Q54 34 105 35Q154 29 165 78L144 69L124 45L97 67Z','HAIR'),
 path('M51 170Q32 123 51 69Q56 33 109 34Q172 33 174 92L166 177L147 149V84Q110 92 74 73L78 164Z','HAIR'),
 path('M61 84Q53 51 81 42Q124 18 159 60L161 83Q124 62 61 84Z','HAIR')+path('M59 75L47 44L90 38L108 66Z',S),
 path('M50 159Q25 116 47 62Q65 15 118 30Q182 28 179 103L169 164L147 158V87Q113 69 77 91L74 158Z','HAIR'),
 path('M63 80L56 44L94 52L126 24L159 47L159 80Q131 63 111 75L96 58L78 86Z','HAIR'),
 path('M60 75Q62 39 84 41Q107 30 122 40Q154 33 161 73L144 62L129 76L111 56L92 73Z','HAIR')+path('M75 131Q110 162 147 131L137 157H86Z','HAIR'),
 path('M58 85Q34 45 69 40Q50 9 84 17Q109 4 126 22Q154 9 160 42Q184 70 159 91L150 66Q94 83 58 85Z','HAIR'),
 path('M52 152Q26 107 44 68Q63 22 110 29Q172 30 180 89L170 161L151 153V85Q111 72 69 88L74 154Z',S)+path('M52 152L110 177L170 161L149 202H73Z',S),
 path('M60 82Q53 41 88 37Q137 24 157 63L161 83Z','HAIR')+path('M48 72Q110 30 175 72L168 84H53Z',G)+path('M73 61L80 20H141L152 62Z',G),
 path('M58 92Q34 70 48 48Q60 25 86 36Q110 15 134 39Q165 28 175 60Q181 84 156 98L150 69Q107 85 65 71Z','HAIR')+circ(60,111,13,G)+circ(160,111,13,G)
]
notes=['Dalgalı kısa bob, yuvarlak yaka','Kıvırcık kısa saç, çilli yüz','Düz uzun saç, ince çerçeve gözlük','Kısa saç, altın saç bandı','Toplu kıvırcık saç, halka küpe','Kısa saç ve dolgun sakal','Gümüş kısa saç, yuvarlak gözlük','Uzun düz saç, altın bluz','Asimetrik saç, adaçayı bandana','Hacimli afro, krem yaka','Dik kısa saç, petrol ceket','Beyaz saç ve sakal, hırka','Yüksek topuz, altın küpe','Adaçayı başörtüsü ve bluz','Altın şapka, iş önlüğü','Kıvırcık saç, kulak üstü kulaklık']
for i in range(16):
 skin=skins[i]; hair=hairs[i]; shirt=[R,S,P,G][i%4]
 head=path(['M64 78Q64 49 110 49Q157 49 157 82L151 125Q141 157 110 158Q76 155 66 124Z','M65 77Q68 45 111 47Q157 48 158 79V123Q151 155 111 164Q72 154 64 124Z','M66 81Q62 45 111 46Q160 49 156 91L146 137Q131 160 108 155Q80 152 69 128Z'][i%3],skin)
 body=rect(0,0,220,240,[C,'#E8EEE2','#F4D5C5','#DAE7E0'][i%4],26)
 # Some hairstyles need an underlayer for distinct silhouettes.
 if i in [0,2,7,9,13]:body+=styles[i].replace('HAIR',hair)
 body+=path('M28 240V218Q33 173 86 173H133Q184 177 193 218V240Z',shirt)
 body+=path('M92 147V179Q110 197 129 179V147Z',skin)+head
 body+=circ(65,105,9,skin)+circ(155,105,9,skin)
 body+=styles[i].replace('HAIR',hair)
 body+=path('M80 94Q88 89 96 94M124 94Q132 88 140 94')
 body+=circ(88,105,3,P)+circ(132,105,3,P)+path('M110 105L106 119H113')
 body+=path(['M96 132Q110 144 125 131','M100 134Q111 137 122 130','M97 132Q110 129 124 132'][i%3])
 body+=f'<g stroke="none" fill="{R}" opacity=".55"><ellipse cx="82" cy="120" rx="8" ry="4"/><ellipse cx="138" cy="120" rx="8" ry="4"/></g>'
 if i in [2,6]:body+=rect(72,97,32,21,'none',8)+rect(116,97,32,21,'none',8)+path('M104 104H116')
 if i in [1,8]:
  for x in [79,85,135,141]:body+=circ(x,121,1,P)
 if i in [4,12]:body+=circ(60,124,6,G)+circ(160,124,6,G)
 if i%3==0:body+=path('M77 181L92 201L110 187L128 201L144 182',C)+path('M110 202V240')
 elif i%3==1:body+=path('M85 182Q110 210 135 182')
 else:body+=path('M85 183L83 240M137 183L140 240',C)+circ(111,219,4,G)
 svg(f'avatars/portrait-{i+1:02}.svg',220,240,body,notes[i])
(OUT/'avatars/manifest.json').write_text(json.dumps([{'id':f'portrait-{i+1:02}','file':f'portrait-{i+1:02}.svg','description':notes[i]} for i in range(16)],ensure_ascii=False,indent=2)+'\n')
# A room vignette: curved window, a sofa, books, tea, rug and a resting cat.
b=rect(0,0,900,600,C,24)+rect(36,35,828,420,'#F4DCCA',12)+path('M0 455H900V600H0Z','#D9BE96')
b+=path('M90 300V145Q90 65 190 65Q290 65 290 145V300Z',P)+path('M102 290V147Q102 80 190 80Q278 80 278 147V290Z','#C8DED5')+circ(228,130,28,G)+path('M190 81V290M102 184H278')
b+=path('M74 67H124L119 300H65ZM258 67H309L318 300H268Z',R)
b+=rect(390,88,102,110,C,6)+path('M410 171L440 109L474 171Z',S)+circ(459,116,12,G)
b+=rect(526,95,86,86,C,5)+path('M542 157Q562 116 596 148Q582 170 542 157Z',R)
b+=rect(356,296,406,148,S,28)+rect(337,353,40,103,S,15)+rect(743,353,40,103,S,15)+path('M380 374H739M560 300V370')
b+=rect(390,316,78,56,R,12)+rect(654,315,75,60,C,12)+path('M401 328L452 363M666 330L714 360',G)
b+=path('M380 445V468M737 445V468')
b+='<ellipse cx="451" cy="508" rx="260" ry="55" fill="#E7A68A"/>'+path('M260 500Q440 550 635 499',C)
b+=rect(360,462,196,21,C,10)+path('M385 482L374 545M515 482L524 545')+rect(415,442,54,17,P,3)+rect(422,432,48,10,R,2)
b+=path('M480 443V426H502V443Q491 453 480 443Z',C)+path('M502 428Q519 426 511 440H502')
b+=plant(808,408,1.5)+rect(52,346,110,100,R,8)
for j in range(5):b+=rect(64+j*17,365-j%2*8,12,60,[P,C,G,S,C][j],2)
b+=path('M634 414Q609 396 620 381L627 373L636 384Q666 375 678 395Q688 416 660 421Z',G)+path('M680 405Q713 393 695 380')
svg('apartment-interior.svg',900,600,b,'Sıcak bir daire: balkon penceresi, kanepe, kitaplar, çay ve uyuyan kedi')
for name,title,body in [
 ('empty-chat.svg','Sohbete ilk merhaba',path('M35 48H180Q196 48 196 64V130Q196 146 180 146H106L78 174V146H35Q20 146 20 130V64Q20 48 35 48Z',C)+circ(67,97,6,R)+circ(108,97,6,G)+circ(149,97,6,S)+plant(181,166,.65)),
 ('empty-mail.svg','Henüz yeni duyuru yok',rect(44,64,132,110,S,16)+path('M44 89H176M72 84V117H153',P)+path('M76 81V34H160V100Z',C)+path('M89 52H144M89 65H130')+circ(167,158,25,R)+path('M155 158L165 168L181 148')),
 ('empty-vote.svg','Birlikte karar verme zamanı',path('M40 105L69 84H153L181 105V179H40Z',S)+path('M40 105H181M82 113H141')+path('M78 35L151 54L134 119L61 99Z',C)+path('M87 71L100 87L127 65')+circ(177,46,13,G))
]:svg(name,220,220,circ(110,110,104,'#E8EEE2')+body,title)
print('Created 23 SVG assets and two geometry/catalog JSON files.')
