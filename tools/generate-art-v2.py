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
def shade(body,opacity=.12): return f'<g stroke="none" fill="{P}" opacity="{opacity}">{body}</g>'
def flower(x,y,color=R): return path(f'M{x} {y+10}V{y-4}')+''.join(circ(x+dx,y+dy,3,color) for dx,dy in [(0,-4),(-4,0),(4,0),(0,4)])+circ(x,y,2,G)
def plant(x,y,scale=1):return f'<g transform="translate({x} {y}) scale({scale})">'+path('M0 0V-40M0-15Q-35-45-25-50Q0-48 0-20M0-25Q25-65 35-50Q32-25 0-12',S)+path('M-20 0H20L15 30H-15Z',R)+'</g>'
# Logo: preserve the petrol mark, cream windows and gold entrance; clarify the roof.
mark=rect(10,12,76,80,P,18)+path('M23 34L48 18L73 34',C)+path('M26 43H38V55H26ZM58 43H70V55H58ZM26 65H38V77H26Z',C)+rect(54,64,18,28,G,2)
svg('logo-mark.svg',96,104,mark,'APARTMAN — komşuluğa açılan kapı')
svg('favicon.svg',96,104,mark,'APARTMAN')
# Facade: four residential rows and a physically separate entrance level.
b=rect(0,0,1000,1100,'#E9F1E8')
b+=circ(825,130,62,G)+path('M0 250Q130 200 240 255M755 285Q900 230 1000 260',C)
b+=path('M20 920V570L120 505L190 570V920M830 920V625L920 555L1000 625V920','#D8E5DA')
b+=rect(162,195,676,760,'#E9D6B8',8)+rect(180,185,640,770,C,6)
b+=rect(198,202,604,625,'#F2D8BD',4)
b+=shade(path('M793 204H817V950H793ZM181 203H818V213H181Z',P),.12)
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
  b+=rect(x+5,y+5,122,93,['#B5D2CC','#C6D8C8','#BACFD0'][(level+col)%3],2)
  b+=shade(path(f'M{x+5} {y+5}H{x+127}V{y+14}H{x+14}V{y+98}H{x+5}Z',P),.15)
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
  # Static decorative vignettes: never presence, ownership or player metadata.
  variant=((level-1)*3+col)%6
  if variant==0:
   b+=rect(x+25,y+113,29,27,S,2)+path(f'M{x+32} {y+117}V{y+136}M{x+43} {y+117}V{y+136}',C)
  elif variant==1:
   for j in range(3):b+=rect(x+78+j*10,y+74-j*4,8,23+j*4,[G,C,R][j],1)
  elif variant==2:
   b+=path(f'M{x+95} {y+8}L{x+82} {y+38}H{x+108}Z',G)+plant(x+95,y+39,.3)
  elif variant==3:
   b+=rect(x+82,y+109,42,17,C,3)
   for j in range(3):b+=flower(x+88+j*13,y+102,[R,G,C][j])
  elif variant==4:
   b+=path(f'M{x+77} {y+91}V{y+77}H{x+94}V{y+91}Z',G)+path(f'M{x+94} {y+78}Q{x+110} {y+75} {x+101} {y+88}H{x+94}')
  else:
   b+=path(f'M{x+87} {y+83}Q{x+95} {y+70} {x+101} {y+83}L{x+112} {y+82}Q{x+106} {y+94} {x+88} {y+92}Z',C)
  b+=shade(path(f'M{x-15} {y+133}H{x+148}L{x+141} {y+139}H{x-8}Z',P),.18)
  anchors.append(dict(number=(level-1)*3+col+1,floor=level,column=col+1,x=x-17,y=y-7,width=166,height=139))
b+=rect(320,842,360,24,C,5) # deliberately blank nameplate
b+=rect(432,874,136,96,P,10)+rect(443,883,51,83,'#B7D3CD',3)+rect(505,883,51,83,'#B7D3CD',3)
b+=circ(487,927,3,G)+circ(512,927,3,G)+rect(410,968,180,13,'#C9B899',3)+rect(392,982,216,12,C,3)
# Layered entrance portal, canopy and warm wall lamps stay below all apartment zones.
b+=path('M414 964V887Q414 865 439 865H562Q586 865 586 887V964').replace('/>',' stroke-width="10"/>')+path('M423 964V889Q423 875 439 875H561Q577 875 577 889V964')
b+=path('M397 879L419 865H580L602 879Z',G)+shade(path('M414 881H586L575 887H425Z',P),.2)
for x in [388,611]:
 b+=f'<ellipse cx="{x}" cy="925" rx="25" ry="40" fill="{G}" stroke="none" opacity=".23"/>'
 b+=rect(x-9,898,18,25,C,4)+path(f'M{x-12} 898H{x+12}M{x} 923V931')
b+=rect(451,972,98,7,P,2)
for x in [230,690]:
 b+=rect(x,884,72,60,R,6)
 for k in range(6):b+=rect(x+6+(k%3)*21,890+(k//3)*24,15,17,C,2)
for x in [140,840]:b+=plant(x,925,1.5)
b+=path('M0 1010Q200 980 395 1010L350 1100H0ZM620 1010Q840 975 1000 1010V1100H665Z',S)
b+=path('M410 995H590L690 1100H310Z','#E9D6B8')
b+=path('M40 1045H260M740 1045H960')
for x in [55,90,125,770,805,840,875,910,945]:b+=path(f'M{x} 1035V1055')
b+=path('M42 968H148M55 968V1001M132 968V1001M46 951H144M50 938H140',G)
# Small shared-garden stories, all outside residential hitboxes.
b+=shade('<ellipse cx="217" cy="1022" rx="81" ry="9"/><ellipse cx="850" cy="1025" rx="88" ry="12"/>',.14)
b+=circ(205,994,23,'none')+circ(290,994,23,'none')+path('M205 994L232 952L259 994H205L248 965L290 994M232 952H220M248 965L258 944H271',R)+path('M220 947H240M260 942H279')+rect(180,957,26,20,G,3)
b+=rect(898,934,7,69,P,2)+path('M874 938V914Q874 897 901 897Q928 897 928 914V938Z',R)+path('M887 919H915M901 901V935')
for x,y in [(35,1022),(329,1040),(744,1025),(961,1045)]:
 b+=path(f'M{x-12} {y+9}Q{x-25} {y-18} {x} {y-9}Q{x+20} {y-23} {x+19} {y+9}Z',S)+flower(x,y-9,R)+flower(x+11,y-3,G)
b+=path('M765 959Q787 940 804 957Q824 938 843 957Q865 945 886 966V979H765Z',S)
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
styles[0]=path('M52 142Q30 96 57 54Q75 24 120 36Q169 42 169 86L161 145L146 135V82Q124 94 109 67Q95 93 70 88L73 140Z','HAIR')
styles[3]=path('M62 82Q58 29 110 30Q167 28 162 82L147 67Q100 58 62 82Z','HAIR')+path('M51 56Q110 7 170 56L166 68H54Z',R)+path('M111 27V53M54 66H168',G)
styles[7]=path('M51 162Q24 140 38 104Q17 61 57 47Q85 14 128 31Q176 30 183 77Q200 104 174 131L174 167L146 150V88Q114 105 78 75L77 154Z','HAIR')
styles[8]=path('M61 78Q47 36 86 30L126 35L154 56L161 87L146 68Q105 82 61 78Z','HAIR')+path('M56 67L58 43Q109 30 159 56L163 72Z',S)
styles[10]=path('M62 88L50 58L64 46L73 26L98 37L122 17L139 39L163 47L160 84L140 64L121 73L99 54L81 82Z','HAIR')
styles[11]=path('M60 77Q55 42 87 34Q110 15 132 39Q158 34 166 78L146 65L128 80L110 56L92 78Z','HAIR')+path('M71 125Q108 151 151 123L144 158L110 175L78 151Z','HAIR')
notes=['Kısa dalgalı bob, mercan fular','Kıvırcık kısa saç, çilli yüz','Düz uzun saç, ince çerçeve gözlük','Mercan bere, yuvarlak yüz, altın kazak','Toplu kıvırcık saç, halka küpe','Kısa saç ve dolgun sakal','Gümüş kısa saç, yuvarlak gözlük','Hacimli dalgalı saç, altın tulum','Kısa saç, adaçayı bandana, köşeli çene','Hacimli afro, krem yaka','Dik kısa saç, geniş yüz, kulak çivisi','Beyaz dalgalı saç, uzun sakal, mercan hırka','Yüksek topuz, altın küpe','Adaçayı başörtüsü ve bluz','Altın şapka, iş önlüğü','Kıvırcık saç, kulak üstü kulaklık']
for i in range(16):
 skin=skins[i]; hair=hairs[i]; shirt=[R,S,P,G][i%4]
 head=path(['M64 78Q64 49 110 49Q157 49 157 82L151 125Q141 157 110 158Q76 155 66 124Z','M65 77Q68 45 111 47Q157 48 158 79V123Q151 155 111 164Q72 154 64 124Z','M66 81Q62 45 111 46Q160 49 156 91L146 137Q131 160 108 155Q80 152 69 128Z'][i%3],skin)
 if i in [0,3,7,8,10,11]:
  head=path({0:'M64 82Q65 49 111 50Q156 50 157 84L149 127Q136 155 110 153Q83 151 70 126Z',3:'M61 81Q59 44 110 43Q163 44 160 89L155 125Q146 160 110 160Q72 161 63 126Z',7:'M67 80Q72 47 113 47Q155 50 154 88L143 129Q129 158 107 157Q83 154 72 128Z',8:'M66 78Q68 47 111 49Q155 48 157 82V126L136 152H85L64 128Z',10:'M60 84Q61 49 111 47Q161 51 161 87L155 129Q139 156 109 155Q79 154 64 129Z',11:'M69 81Q72 44 114 44Q157 47 154 90L143 139Q127 162 106 158Q82 155 72 129Z'}[i],skin)
 body=rect(0,0,220,240,[C,'#E8EEE2','#F4D5C5','#DAE7E0'][i%4],26)
 # Some hairstyles need an underlayer for distinct silhouettes.
 if i in [0,2,7,9,13]:body+=styles[i].replace('HAIR',hair)
 body+=path('M28 240V218Q33 173 86 173H133Q184 177 193 218V240Z',shirt)
 body+=path('M92 147V179Q110 197 129 179V147Z',skin)+head
 body+=circ(65,105,9,skin)+circ(155,105,9,skin)
 body+=styles[i].replace('HAIR',hair)
 body+=path('M80 94Q88 89 96 94M124 94Q132 88 140 94')
 body+=circ(88,105,3,P)+circ(132,105,3,P)+path('M110 105L106 119H113')
 mouths=['M96 132Q110 144 125 131','M100 134Q111 137 122 130','M97 132Q110 129 124 132']
 mouth={0:'M97 132Q110 145 125 130',3:'M97 132Q110 153 126 132Z',7:'M100 132Q112 140 123 129',8:'M97 134L120 132',10:'M94 131Q109 148 128 132Z',11:'M101 137Q111 143 121 135'}.get(i,mouths[i%3])
 body+=path(mouth,C if i in [3,10] else 'none')
 body+=f'<g stroke="none" fill="{R}" opacity=".55"><ellipse cx="82" cy="120" rx="8" ry="4"/><ellipse cx="138" cy="120" rx="8" ry="4"/></g>'
 if i in [2,6]:body+=rect(72,97,32,21,'none',8)+rect(116,97,32,21,'none',8)+path('M104 104H116')
 if i in [1,8]:
  for x in [79,85,135,141]:body+=circ(x,121,1,P)
 if i in [4,12]:body+=circ(60,124,6,G)+circ(160,124,6,G)
 if i%3==0:body+=path('M77 181L92 201L110 187L128 201L144 182',C)+path('M110 202V240')
 elif i%3==1:body+=path('M85 182Q110 210 135 182')
 else:body+=path('M85 183L83 240M137 183L140 240',C)+circ(111,219,4,G)
 if i==0:body+=path('M82 177L110 190L138 177L130 203L111 193L95 214Z',R)
 if i==3:body+=path('M72 195H148M68 209H153M66 224H157',C)
 if i==7:body+=path('M71 183L77 240H143L149 183M77 204H143',G)+rect(93,210,34,22,R,3)
 if i==8:body+=path('M77 181L88 240M142 181L130 240',P)+path('M98 188H122V240H98Z',C)
 if i==10:body+=circ(156,117,4,G)+path('M84 184L110 216L139 184',R)
 if i==11:body+=path('M73 182L91 240H53L64 194ZM144 183L130 240H170L158 194Z',R)+circ(111,209,4,P)
 svg(f'avatars/portrait-{i+1:02}.svg',220,240,body,notes[i])
(OUT/'avatars/manifest.json').write_text(json.dumps([{'id':f'portrait-{i+1:02}','file':f'portrait-{i+1:02}.svg','description':notes[i]} for i in range(16)],ensure_ascii=False,indent=2)+'\n')
# A room vignette: curved window, a sofa, books, tea, rug and a resting cat.
b=rect(0,0,900,600,C,24)+rect(36,35,828,420,'#F4DCCA',12)+path('M0 455H900V600H0Z','#D9BE96')
b+=path('M90 300V145Q90 65 190 65Q290 65 290 145V300Z',P)+path('M102 290V147Q102 80 190 80Q278 80 278 147V290Z','#C8DED5')+circ(228,130,28,G)+path('M190 81V290M102 184H278')
b+=path('M74 67H124L119 300H65ZM258 67H309L318 300H268Z',R)
b+=rect(390,88,102,110,C,6)+path('M410 171L440 109L474 171Z',S)+circ(459,116,12,G)
b+=rect(526,95,86,86,C,5)+path('M542 157Q562 116 596 148Q582 170 542 157Z',R)
# Soft lamp light, wall clock and shelf: atmospheric art, not purchasable objects.
b+=f'<ellipse cx="318" cy="300" rx="74" ry="96" fill="{G}" stroke="none" opacity=".16"/>'
b+=path('M315 315V453M290 454H340',P)+path('M285 310L297 255H337L350 310Z',G)+path('M299 263H334',C)
b+=circ(753,104,31,C)+path('M753 84V104L769 115')+circ(753,104,3,P)
b+=rect(641,213,168,13,R,4)+shade(path('M644 227H806L797 236H652Z',P),.12)
for j in range(4):b+=rect(653+j*14,170-j%2*9,11,42+j%2*9,[P,G,S,C][j],2)
b+=rect(727,171,29,39,C,3)+path('M733 201L742 184L751 201Z',R)+plant(786,198,.43)
b+=shade('<ellipse cx="561" cy="460" rx="230" ry="17"/>',.12)
b+=rect(356,296,406,148,S,28)+rect(337,353,40,103,S,15)+rect(743,353,40,103,S,15)+path('M380 374H739M560 300V370')
b+=rect(390,316,78,56,R,12)+rect(654,315,75,60,C,12)+path('M401 328L452 363M666 330L714 360',G)
b+=path('M380 445V468M737 445V468')
b+='<ellipse cx="451" cy="508" rx="260" ry="55" fill="#E7A68A"/>'+path('M260 500Q440 550 635 499',C)
b+=rect(360,462,196,21,C,10)+path('M385 482L374 545M515 482L524 545')+rect(415,442,54,17,P,3)+rect(422,432,48,10,R,2)
b+=path('M480 443V426H502V443Q491 453 480 443Z',C)+path('M502 428Q519 426 511 440H502')
b+=plant(808,408,1.5)+rect(52,346,110,100,R,8)
for j in range(5):b+=rect(64+j*17,365-j%2*8,12,60,[P,C,G,S,C][j],2)
b+=path('M634 414Q609 396 620 381L627 373L636 384Q666 375 678 395Q688 416 660 421Z',G)+path('M680 405Q713 393 695 380')
b+=path('M177 340H253V353H177Z',R)+rect(186,301,26,39,C,3)+circ(199,316,7,G)+plant(235,332,.6)
b+=path('M676 338L691 344L706 339L705 397L690 404L675 397Z',G)+path('M680 352H701M680 362H701M679 373H701',C)
b+=rect(552,467,36,11,R,2)+rect(557,457,34,9,C,2)+path('M562 460H585')
b+=path('M489 420Q482 412 490 403M498 420Q491 412 499 403',G)
svg('apartment-interior.svg',900,600,b,'Sıcak bir daire: balkon penceresi, kanepe, kitaplar, çay ve uyuyan kedi')
for name,title,body in [
 ('empty-chat.svg','Sohbete ilk merhaba',path('M35 48H180Q196 48 196 64V130Q196 146 180 146H106L78 174V146H35Q20 146 20 130V64Q20 48 35 48Z',C)+circ(67,97,6,R)+circ(108,97,6,G)+circ(149,97,6,S)+plant(181,166,.65)),
 ('empty-mail.svg','Henüz yeni duyuru yok',rect(44,64,132,110,S,16)+path('M44 89H176M72 84V117H153',P)+path('M76 81V34H160V100Z',C)+path('M89 52H144M89 65H130')+circ(167,158,25,R)+path('M155 158L165 168L181 148')),
 ('empty-vote.svg','Birlikte karar verme zamanı',path('M40 105L69 84H153L181 105V179H40Z',S)+path('M40 105H181M82 113H141')+path('M78 35L151 54L134 119L61 99Z',C)+path('M87 71L100 87L127 65')+circ(177,46,13,G))
]:svg(name,220,220,circ(110,110,104,'#E8EEE2')+body,title)
print('Created 23 SVG assets and two geometry/catalog JSON files.')
