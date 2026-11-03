/* FIXER'S CUT — 静的データ（ロール・出自・義体・依頼・物語）。数値はすべて仮。 */

const CORPS = ['mitsukane', 'verde', 'hakurou'];
const CLIENTS = {
  mitsukane: { name: 'ミツカネ重工', short: 'ミツカネ', kind: 'corp' },
  verde: { name: 'ヴェルデ製薬', short: 'ヴェルデ', kind: 'corp' },
  hakurou: { name: 'ハクロウ通信', short: 'ハクロウ', kind: 'corp' },
  gang: { name: '白蛇会', short: '白蛇会', kind: 'gang' },
  resident: { name: '屋台街の住民', short: '住民', kind: 'resident' },
  broker: { name: '顔役', short: '顔役', kind: 'broker' },
  self: { name: 'ブラックボックス', short: '箱', kind: 'self' },
};

const SKILLS = ['射撃', '回避', '隠密', '知覚', '電子', 'インターフェース', '医療', '運転', '説得'];
const SKILL_STAT = {
  射撃: 'REF', 回避: 'REF', 隠密: 'COOL', 知覚: 'INT', 電子: 'TECH',
  インターフェース: 'INT', 医療: 'TECH', 運転: 'REF', 説得: 'COOL',
};
const STATS = ['BODY', 'REF', 'INT', 'TECH', 'COOL', 'EMP'];

/* 性別は肖像の絵を選ぶためだけに使う。x は中性的・アンドロイド風 */
const GENDERS = { m: '男性', f: '女性', x: 'その他' };

const ROLES = {
  solo: {
    name: 'ソロ', tag: 'SOLO', armor: 11,
    base: { BODY: [6, 8], REF: [7, 9], INT: [3, 5], TECH: [3, 5], COOL: [5, 7], EMP: [4, 6] },
    skills: { 射撃: [5, 7], 回避: [4, 6], 隠密: [2, 4], 知覚: [2, 4], 運転: [1, 2] },
    perk: { id: 'double', name: '二連射', desc: '交戦で1ラウンドに2回撃つ' },
    desc: '交戦の要。撃って、かわす。',
  },
  net: {
    name: 'ネットランナー', tag: 'NET', armor: 7,
    base: { BODY: [3, 5], REF: [4, 6], INT: [7, 9], TECH: [5, 7], COOL: [4, 6], EMP: [4, 7] },
    skills: { インターフェース: [5, 7], 電子: [2, 4], 知覚: [3, 5], 隠密: [1, 3], 回避: [1, 3], 射撃: [0, 2] },
    perk: { id: 'backdoor', name: '裏口', desc: 'ICE判定に+2' },
    desc: 'ネットのレーン担当。いないと開かない扉がある。',
  },
  tech: {
    name: 'テック', tag: 'TECH', armor: 7,
    base: { BODY: [4, 6], REF: [4, 6], INT: [5, 7], TECH: [7, 9], COOL: [4, 6], EMP: [4, 6] },
    skills: { 電子: [5, 7], 知覚: [3, 5], 射撃: [2, 3], 回避: [1, 3], 隠密: [2, 3] },
    perk: { id: 'patch', name: '即席修理', desc: '休息フェーズで全員の防具を2戻す' },
    desc: '隔壁や金庫を開ける。',
  },
  med: {
    name: 'メドテック', tag: 'MED', armor: 7,
    base: { BODY: [4, 6], REF: [4, 6], INT: [6, 8], TECH: [6, 8], COOL: [5, 7], EMP: [5, 8] },
    skills: { 医療: [5, 7], 知覚: [3, 5], 回避: [2, 3], 射撃: [1, 3], 説得: [1, 3] },
    perk: { id: 'surgeon', name: '外科処置', desc: '仲間の死亡セーブに+2' },
    desc: '休息で傷を縫い、死にかけた仲間を引き戻す。',
  },
  driver: {
    name: 'ドライバー', tag: 'DRV', armor: 7,
    base: { BODY: [4, 6], REF: [7, 9], INT: [4, 6], TECH: [5, 7], COOL: [5, 7], EMP: [4, 6] },
    skills: { 運転: [5, 7], 射撃: [2, 4], 回避: [3, 5], 知覚: [2, 4] },
    perk: { id: 'getaway', name: '逃げ足', desc: '逃走と運転の判定に+3' },
    desc: '逃走と運び。いないと帰ってこられない仕事がある。',
  },
};

const ORIGINS = {
  corp: { name: '企業育ち', mods: { INT: 1, COOL: 1, BODY: -1 }, skills: { 説得: 2 }, desc: '企業1社に顔が利く' },
  street: { name: '路上育ち', mods: { BODY: 1, REF: 1, EMP: -1 }, skills: { 隠密: 1, 射撃: 1 }, desc: '白蛇会に顔が利く' },
  drifter: { name: '流れ者', mods: { EMP: 1 }, skills: { 知覚: 1, 運転: 1 }, desc: '屋台街に顔が利く。分け前の要求が控えめ' },
};

const NAMES = ['ミナ', 'ジロウ', 'テツ', 'サエ', 'レン', 'アキ', 'ソラ', 'ナギ', 'ケイ', 'ユウ', 'マコ', 'ゴウ',
  'リツ', 'シズ', 'タキ', 'ヒロ', 'イオ', 'ミツ', 'ルカ', 'コウ', 'スズ', 'ダイ', 'エマ', 'トウヤ', 'ノア',
  'カイ', 'ヒナ', 'ジン', 'ウタ', 'セツ', 'オボロ', 'チカ', 'マドカ', 'ロク', 'ニコ',
  'ヨミ', 'クレハ', 'サカキ', 'ナユタ', 'ホタル', 'ミサゴ', 'ツグミ', 'アラタ', 'キリ', 'ハヤテ', 'ユズ', 'トキ'];

/* 雇えるランナーの素性。出自ごとの「昔」と「癖」を1つずつ組み合わせる */
const BIOS = {
  corp: {
    past: ['ミツカネの社員寮で育った。', '元はヴェルデの治験コーディネーターだった。', '企業警備の訓練課程を、最後の週に抜けた。', '親の代からハクロウの社員番号を持っていた。', '上層の受付で、毎朝千人の顔を照合していた。'],
    quirk: ['社章の跡が、まだ襟に残っている。', '敬語が抜けない。撃つときも。', '退職金の代わりに持ち出したものの話はしない。', '名刺を一枚だけ捨てられずにいる。'],
  },
  street: {
    past: ['白蛇会の使い走りから始めた。', '屋台街の裏の、湯気の中で生まれた。', '十四で最初の義体を盗んだ。', '港の荷役で腕を一本だめにした。', '水没区の違法ジムで、賭けの的をやっていた。'],
    quirk: ['借りは必ず返す。貸しも必ず取り立てる。', '金の話になると目の色が変わる。', '合成煙草の銘柄にうるさい。', '仕事の前には必ず屋台の麺をすする。'],
  },
  drifter: {
    past: ['北の水没区から、浮き桟橋づたいに流れてきた。', '貨物船の底で街に着き、そのまま居ついた。', '三つの都市で名前を変えた。ここが四つ目だ。', '軌道エレベーターの建設現場で働いていた。', '人の記憶を運ぶ「運び屋」をしていたらしい。'],
    quirk: ['荷物は鞄ひとつだけ。', '雨の音がないと眠れない。', '誰の過去も聞かない。自分のも話さない。', '古い紙の地図を持ち歩いている。'],
  },
};

/* 物語つきのランナー（3人） */
const STORY_RUNNERS = {
  kagerou: {
    name: 'カゲロウ', gender: 'x', role: 'net', origin: 'corp', contact: 'hakurou',
    base: { BODY: 4, REF: 5, INT: 9, TECH: 6, COOL: 5, EMP: 6 },
    skills: { インターフェース: 7, 電子: 4, 知覚: 4, 隠密: 2, 回避: 2, 射撃: 1, 説得: 2 },
    cyber: [],
    bio: 'ハクロウ通信の元回線技師。社内で見てはいけないログを見て、三日後に退職届も出さずに消えた。前任のハシバとは面識があったらしい。',
  },
  yoru: {
    name: 'ヨル', gender: 'm', role: 'solo', origin: 'corp', contact: 'mitsukane',
    base: { BODY: 7, REF: 8, INT: 5, TECH: 4, COOL: 7, EMP: 5 },
    skills: { 射撃: 6, 回避: 5, 隠密: 3, 知覚: 3, 運転: 2, 説得: 2 },
    cyber: ['arm', 'optics'], trait: 'tolerant',
    bio: 'ミツカネ重工の元警備主任。会社に義体を回収される前に逃げた。腕も目も、もう半分は自分のものではない。',
  },
  haruka: {
    name: 'ハルカ', gender: 'f', role: 'med', origin: 'street', contact: 'gang',
    base: { BODY: 5, REF: 5, INT: 7, TECH: 8, COOL: 6, EMP: 8 },
    skills: { 医療: 7, 知覚: 4, 回避: 3, 射撃: 2, 説得: 3, 隠密: 2 },
    cyber: [],
    bio: '屋台街で無許可の診療所を開いていた。白蛇会に店を焼かれてから、誰とも組んでいない。',
  },
  shigure: {
    name: 'シグレ', gender: 'f', role: 'driver', origin: 'drifter', contact: 'resident',
    base: { BODY: 5, REF: 9, INT: 5, TECH: 6, COOL: 6, EMP: 5 },
    skills: { 運転: 7, 射撃: 3, 回避: 4, 知覚: 3, 隠密: 1 },
    cyber: ['steering'],
    bio: '湾岸の非合法レースで、三年間一度も負けなかった。最後の賭けでクロガネに愛車を担保に取られ、今は他人の車を転がしている。',
  },
  mikoto: {
    name: 'ミコト', gender: 'x', role: 'tech', origin: 'corp', contact: 'verde',
    base: { BODY: 4, REF: 5, INT: 7, TECH: 9, COOL: 4, EMP: 5 },
    skills: { 電子: 7, 知覚: 4, 射撃: 2, 回避: 2, 隠密: 3, 医療: 1 },
    cyber: ['toolfinger'],
    bio: 'ヴェルデ製薬の「人格転写」治験の被験者。目が覚めたとき、隣の寝台に自分と同じ顔が眠っていた。どちらが元の自分なのか、まだ確かめていない。',
  },
};

/* 義体。cat は部位のカテゴリ、line は同じ系統（上位モデルは line に下位モデルのIDを書く）、tier はモデルの段階。
   同じ系統の上位モデルを入れると下位モデルと入れ替わり、人間性は差の分だけ減る。
   loan = [1夜あたり, 夜数]。現金なら総額の8割。look は肖像の描き方を借りる義体のID */
const CYBER_CATS = { nervous: '神経系', brain: '頭脳', senses: '感覚・発声', arms: '腕と手', skin: '体表', organs: '内臓' };
const CYBER = {
  // 神経系
  synapse: { name: 'シナプス加速器', cat: 'nervous', part: '神経', tier: 1, mods: { REF: 1 }, loan: [600, 10], hl: 6, desc: 'REF+1（射撃・回避・運転に効く）' },
  reflex: { name: '反射増幅器「瞬」', cat: 'nervous', part: '脊椎', line: 'synapse', tier: 2, mods: { REF: 2 }, loan: [1000, 10], hl: 12, desc: 'REF+2（射撃・回避・運転）。軍の横流し品' },
  reflex3: { name: '反射増幅器「瞬・極」', cat: 'nervous', part: '脊椎', line: 'synapse', tier: 3, look: 'reflex', mods: { REF: 3 }, loan: [1600, 10], hl: 20, desc: 'REF+3。世界が止まって見える。止まって見えるのは世界だけではない' },
  steering: { name: '反射ステアリング', cat: 'nervous', part: '脊髄', tier: 1, mods: { 運転: 2 }, loan: [400, 10], hl: 4, desc: '運転+2' },
  steering2: { name: '反射ステアリング・競技仕様', cat: 'nervous', part: '脊髄', line: 'steering', tier: 2, look: 'steering', mods: { 運転: 4 }, loan: [800, 10], hl: 9, desc: '運転+4。湾岸の非合法レースで使われていた型' },
  painblock: { name: '痛覚遮断', cat: 'nervous', part: '脳幹', tier: 1, mods: {}, loan: [300, 10], hl: 5, desc: '重傷の−2を無視する' },
  // 頭脳
  coproc: { name: '解析コプロセッサ', cat: 'brain', part: '脳', tier: 1, mods: { INT: 1 }, loan: [600, 10], hl: 6, desc: 'INT+1（知覚・ICEに効く）' },
  coproc2: { name: '解析コプロセッサMk.II', cat: 'brain', part: '脳', line: 'coproc', tier: 2, look: 'coproc', mods: { INT: 2 }, loan: [1100, 10], hl: 12, desc: 'INT+2。考える前に答えが出ている' },
  tacai: { name: '戦術AI「カゲボウシ」', cat: 'brain', part: '脳', tier: 1, mods: { INT: 1, 知覚: 1 }, loan: [700, 10], hl: 8, desc: 'INT+1 知覚+1。ときどき勝手に話しかけてくる' },
  tacai2: { name: '戦術AI「カゲボウシ改」', cat: 'brain', part: '脳', line: 'tacai', tier: 2, look: 'tacai', mods: { INT: 2, 知覚: 2 }, loan: [1300, 10], hl: 15, desc: 'INT+2 知覚+2。もう黙らない' },
  jack: { name: '高速ニューラルジャック', cat: 'brain', part: '首', tier: 1, mods: { インターフェース: 2 }, loan: [500, 10], hl: 5, desc: 'インターフェース+2' },
  jack2: { name: '軍用ニューラルジャック', cat: 'brain', part: '首', line: 'jack', tier: 2, look: 'jack', mods: { インターフェース: 4 }, loan: [1000, 10], hl: 11, desc: 'インターフェース+4。ネットの中のほうが、体より軽い' },
  firewall: { name: 'ニューラル防壁', cat: 'brain', part: '脳幹', tier: 1, mods: {}, loan: [400, 10], hl: 4, desc: '黒ICEの逆流と敵ネットランナーの攻撃を受けない' },
  emochip: { name: '感情抑制チップ', cat: 'brain', part: '前頭葉', tier: 1, mods: { COOL: 2 }, loan: [500, 10], hl: 10, desc: 'COOL+2（隠密・説得）。心のほうが先に削れる' },
  // 感覚・発声
  optics: { name: '鷹の目オプティクス', cat: 'senses', part: '目', tier: 1, mods: { 射撃: 2, 知覚: 1 }, loan: [500, 10], hl: 5, desc: '射撃+2 知覚+1' },
  optics2: { name: '鷹の目オプティクスMk.II', cat: 'senses', part: '目', line: 'optics', tier: 2, look: 'optics', mods: { 射撃: 3, 知覚: 2 }, loan: [900, 10], hl: 10, desc: '射撃+3 知覚+2。弾道が線で見える' },
  ears: { name: '音響センサー', cat: 'senses', part: '耳', tier: 1, mods: { 知覚: 2, 隠密: 1 }, loan: [300, 10], hl: 3, desc: '知覚+2 隠密+1' },
  ears2: { name: '音響センサー・軍用', cat: 'senses', part: '耳', line: 'ears', tier: 2, look: 'ears', mods: { 知覚: 3, 隠密: 2 }, loan: [600, 10], hl: 7, desc: '知覚+3 隠密+2。壁の向こうの心音まで拾う' },
  voice: { name: '声帯変調器', cat: 'senses', part: '喉', tier: 1, mods: { 説得: 2, 隠密: 1 }, loan: [300, 10], hl: 3, desc: '説得+2 隠密+1' },
  voice2: { name: '声帯変調器・詐欺師仕様', cat: 'senses', part: '喉', line: 'voice', tier: 2, look: 'voice', mods: { 説得: 4, 隠密: 1 }, loan: [700, 10], hl: 8, desc: '説得+4 隠密+1。誰の声でも出せる。自分の声は忘れた' },
  // 腕と手
  arm: { name: '鉄骨アーム', cat: 'arms', part: '腕', tier: 1, mods: { BODY: 1, 射撃: 1 }, loan: [400, 10], hl: 5, desc: 'BODY+1 射撃+1' },
  arm2: { name: '鉄骨アームMk.II', cat: 'arms', part: '腕', line: 'arm', tier: 2, look: 'arm', mods: { BODY: 2, 射撃: 2 }, loan: [900, 10], hl: 11, desc: 'BODY+2 射撃+2。反動を腕だけで殺す' },
  toolfinger: { name: '工具指', cat: 'arms', part: '手', tier: 1, mods: { 電子: 2 }, loan: [300, 10], hl: 3, desc: '電子+2' },
  toolfinger2: { name: '多機能工具腕', cat: 'arms', part: '手', line: 'toolfinger', tier: 2, look: 'toolfinger', mods: { 電子: 4 }, loan: [700, 10], hl: 8, desc: '電子+4。指が十二本ある' },
  // 体表
  plating: { name: '皮下装甲板', cat: 'skin', part: '皮膚', tier: 1, mods: { armor: 4 }, loan: [400, 10], hl: 4, desc: '防具の上限+4' },
  milplate: { name: '軍用皮下装甲', cat: 'skin', part: '全身', line: 'plating', tier: 2, mods: { armor: 6 }, loan: [800, 10], hl: 8, desc: '防具の上限+6' },
  plating3: { name: '多層装甲外殻', cat: 'skin', part: '全身', line: 'plating', tier: 3, look: 'milplate', mods: { armor: 9 }, loan: [1400, 10], hl: 14, desc: '防具の上限+9。触れても、もう体温はない' },
  chameleon: { name: '擬態皮膚', cat: 'skin', part: '皮膚', tier: 1, mods: { 隠密: 3 }, loan: [600, 10], hl: 7, desc: '隠密+3。周りの色を拾って溶け込む' },
  // 内臓
  medkit: { name: '皮下メディキット', cat: 'organs', part: '体内', tier: 1, mods: { 医療: 1 }, loan: [300, 10], hl: 3, desc: '医療+1。休息で自分のHP+5' },
  heart: { name: '人工心臓「ツヅミ」', cat: 'organs', part: '胸', tier: 1, mods: { BODY: 1 }, loan: [700, 10], hl: 6, desc: 'BODY+1。死亡セーブに+2' },
  heart2: { name: '人工心臓「ツヅミ・弐」', cat: 'organs', part: '胸', line: 'heart', tier: 2, look: 'heart', mods: { BODY: 2 }, loan: [1200, 10], hl: 12, desc: 'BODY+2。死亡セーブに+3。鼓動は、もう聞こえない' },
  // ボスが落とす義体（drop）。闇医者では売らず、ボスを倒した大仕事の報酬にだけ出る。roles は合うロール
  kanameEye: { name: 'カナメの狙撃用義眼', cat: 'senses', part: '目', tier: 1, look: 'optics', mods: { 射撃: 2, 知覚: 3 }, loan: [1000, 10], hl: 10, roles: ['solo', 'driver'], drop: true, desc: '射撃+2 知覚+3。回収屋の頭が、標的を一度も見失わなかった目' },
};

/* ランナーの資質。まれに付く。humCap は人間性の上限を固定、humBonus は上乗せ、hlMult は義体の人間性コストの倍率、
   xpBonus は技能の上昇に必要な判定を減らす、pay は分け前の希望と手当の倍率 */
const TRAITS = {
  anomaly: { name: '異常適合', rarity: 'legend', humCap: 150, hlMult: 0.5, pay: 1.8, desc: '人間性の上限150、義体の人間性コストが半分。体が機械を拒まない、千人に一人の体質' },
  tolerant: { name: '適合体質', rarity: 'rare', humBonus: 30, hlMult: 0.75, pay: 1.3, desc: '人間性の上限+30、義体の人間性コストが3/4' },
  prodigy: { name: '天才肌', rarity: 'rare', xpBonus: 2, pay: 1.2, desc: '技能の伸びが早い（上昇に必要な判定が2回少ない）' },
};
const TRAIT_ODDS = [['anomaly', 0.03], ['tolerant', 0.10], ['prodigy', 0.08]];

/* 装備（人間性を削らない成長）。部位ごとに1つ。歩合は本人の手持ち、専属はフィクサーが払う。 */
const GEAR_SLOTS = { weapon: '武器', body: '防具', tool: '道具' };
const GEAR = {
  pistol: { name: '重拳銃「ナナミ」', slot: 'weapon', price: 800, mods: { 射撃: 1 }, roles: ['solo', 'driver', 'tech', 'med'], desc: '射撃+1' },
  smg: { name: 'スマートSMG', slot: 'weapon', price: 2400, mods: { 射撃: 2 }, roles: ['solo', 'driver'], desc: '射撃+2' },
  aprifle: { name: '徹甲ライフル', slot: 'weapon', price: 2800, mods: { 射撃: 1 }, ap: true, roles: ['solo'], desc: '射撃+1。テックがいなくても装甲兵の弱点を撃ち抜く' },
  jacket: { name: '防弾ジャケット', slot: 'body', price: 700, mods: { armor: 2 }, roles: ['solo', 'driver', 'tech', 'med', 'net'], desc: '防具の上限+2' },
  heavyvest: { name: '重装甲ベスト', slot: 'body', price: 1800, mods: { armor: 4, 回避: -1 }, roles: ['solo'], desc: '防具の上限+4、回避−1' },
  poncho: { name: '光学迷彩ポンチョ', slot: 'body', price: 1600, mods: { 隠密: 2 }, roles: ['solo', 'tech', 'net'], desc: '隠密+2' },
  deck: { name: 'サイバーデッキ改', slot: 'tool', price: 1200, mods: { インターフェース: 1 }, roles: ['net'], desc: 'インターフェース+1' },
  milDeck: { name: '軍用デッキ', slot: 'tool', price: 3200, mods: { インターフェース: 2 }, roles: ['net'], desc: 'インターフェース+2' },
  toolkit: { name: '電子工具セット', slot: 'tool', price: 900, mods: { 電子: 2 }, roles: ['tech'], desc: '電子+2' },
  medbag: { name: '野戦医療バッグ', slot: 'tool', price: 900, mods: { 医療: 2 }, roles: ['med'], desc: '医療+2' },
  scanner: { name: '熱源スキャナー', slot: 'tool', price: 900, mods: { 知覚: 2 }, roles: ['solo', 'tech', 'net', 'med'], desc: '知覚+2（罠・狙撃手に効く）' },
  rig: { name: 'ドライブリグ', slot: 'tool', price: 1000, mods: { 運転: 2 }, roles: ['driver'], desc: '運転+2' },
  earpiece: { name: '交渉用イヤピース', slot: 'tool', price: 800, mods: { 説得: 2 }, roles: ['med', 'driver'], desc: '説得+2' },
  silenced: { name: 'サイレンサー拳銃「ヨダカ」', slot: 'weapon', price: 1500, mods: { 射撃: 1, 隠密: 1 }, roles: ['solo', 'tech', 'net', 'med'], desc: '射撃+1 隠密+1' },
  taser: { name: 'テーザー「ナマズ」', slot: 'weapon', price: 900, mods: { 射撃: 1 }, nonlethal: true, roles: ['med', 'driver', 'tech', 'net'], desc: '射撃+1。殺さずに倒すので、過剰な暴力にならない' },
  railgun: { name: '試作レールガン', slot: 'weapon', price: 5000, mods: { 射撃: 3 }, roles: ['solo'], desc: '射撃+3。ミツカネの試作品が闇市に流れたもの' },
  weave: { name: '防刃メッシュスーツ', slot: 'body', price: 1200, mods: { armor: 3 }, roles: ['solo', 'driver', 'tech', 'med', 'net'], desc: '防具の上限+3' },
  icehood: { name: 'ICE遮断フード', slot: 'body', price: 1400, mods: { インターフェース: 1 }, iceguard: true, roles: ['net'], desc: 'インターフェース+1。黒ICEの逆流を半分にする' },
  decoy: { name: 'デコイ・ドローン', slot: 'tool', price: 1400, mods: { 回避: 2 }, roles: ['solo', 'driver', 'tech'], desc: '回避+2。敵の照準を引きつける' },
  fakeid: { name: '偽造IDチップ', slot: 'tool', price: 1000, mods: { 説得: 1, 隠密: 1 }, roles: ['solo', 'driver', 'tech', 'med', 'net'], desc: '説得+1 隠密+1。今夜だけ別人になれる' },
  qpick: { name: '量子ピッキング端末', slot: 'tool', price: 2600, mods: { 電子: 3 }, roles: ['tech'], desc: '電子+3' },
  // ボスが落とす装備（drop）。古物屋では売らない
  denkiDeck: { name: '電気屋のデッキ', slot: 'tool', price: 4000, mods: { インターフェース: 2 }, iceguard: true, roles: ['net'], drop: true, desc: 'インターフェース+2。黒ICEの逆流を半分にする。電気屋が鍵をこじ開けるのに使っていた' },
};

/* 型。義体・装備・資質はどれも型を1つか2つ持つ。依頼に送り出した人の型を数え、2つ・4つ・6つで隊全体に効果が付く（engine.js の typeOn） */
const TYPES = {
  stealth: { name: '隠密', fx: { 2: '隠密の判定+1', 4: '隠密に成功すると、次の交戦の敵−1', 6: '依頼ごとに1回、交戦を丸ごと避ける' } },
  fire: { name: '火力', fx: { 2: '1ラウンド目の射撃+1', 4: '敵を倒した人が、そのラウンドにもう一度撃つ', 6: '待ち伏せされず、1ラウンド目は必ず先に撃つ' } },
  net: { name: '電脳', fx: { 2: 'ICE判定+2', 4: 'ネットを抜けると、次の交戦の敵のDVと攻撃−1', 6: '黒ICEの逆流を受けない' } },
  chrome: { name: '義体狂い', fx: { 2: '人間性30以下の人の射撃+1', 4: '人間性30以下の人の回避+1', 6: '暴走中の人が倒れない（その交戦だけ）' } },
  endure: { name: '持久', fx: { 2: '交戦のあと全員HP+5。重傷の判定−2を受けない', 4: '交戦を4ラウンドまで粘れる（ふつうは3ラウンドで撤退）。死亡セーブ+2', 6: '依頼ごとに1回、死ぬはずの人が動けないだけで済む' } },
};
const TYPE_STEPS = [2, 4, 6];
const CYBER_TYPES = {
  synapse: ['fire'], reflex: ['fire', 'chrome'], reflex3: ['fire', 'chrome'], steering: ['endure'], steering2: ['endure'], painblock: ['endure', 'chrome'],
  coproc: ['net'], coproc2: ['net'], tacai: ['stealth'], tacai2: ['stealth', 'chrome'], jack: ['net'], jack2: ['net', 'chrome'], firewall: ['net'], emochip: ['stealth', 'chrome'],
  optics: ['fire'], optics2: ['fire'], ears: ['stealth'], ears2: ['stealth'], voice: ['stealth'], voice2: ['stealth'],
  arm: ['fire'], arm2: ['fire', 'chrome'], toolfinger: ['net'], toolfinger2: ['net'],
  plating: ['endure'], milplate: ['endure', 'chrome'], plating3: ['endure', 'chrome'], chameleon: ['stealth'],
  medkit: ['endure'], heart: ['endure'], heart2: ['endure', 'chrome'], kanameEye: ['fire', 'stealth'],
};
const GEAR_TYPES = {
  pistol: ['fire'], smg: ['fire'], aprifle: ['fire'], railgun: ['fire'], silenced: ['stealth', 'fire'], taser: ['stealth'],
  jacket: ['endure'], heavyvest: ['endure'], weave: ['endure'], poncho: ['stealth'], icehood: ['net', 'endure'],
  deck: ['net'], milDeck: ['net'], toolkit: ['net'], qpick: ['net'], denkiDeck: ['net'],
  medbag: ['endure'], scanner: ['stealth'], rig: ['endure'], earpiece: ['stealth'], decoy: ['endure'], fakeid: ['stealth'],
};
const TRAIT_TYPES = { anomaly: ['chrome'], tolerant: ['chrome'] };
for (const [k, t] of Object.entries(CYBER_TYPES)) CYBER[k].types = t;
for (const [k, t] of Object.entries(GEAR_TYPES)) GEAR[k].types = t;
for (const [k, t] of Object.entries(TRAIT_TYPES)) TRAITS[k].types = t;

/* コネ。ラン中ずっと効く特殊効果。報酬の3つ目の枠で手に入る。boss のコネは大仕事の報酬にだけ出て、強いかわりに弱みを持つ */
const CONNECTIONS = {
  blackmarket: { name: '闇市の顔役', desc: '古物屋と闇医者が2割引き' },
  gangDebt: { name: '白蛇会の貸し', desc: '臨時雇いが各幕1回無料（大仕事の無料とは別）' },
  dawnDoc: { name: '夜明けの闇医者', desc: '隠れ家の夜、人間性がいちばん低い人の人間性+10' },
  scanner: { name: '警察無線の盗聴', desc: '鎮圧班をかばっても、市警の手配がつかない' },
  courier: { name: '運び屋の顔', desc: '運転と逃走の判定+2' },
  veteran: { name: '古参の勘', desc: '知覚の判定+2（狙撃手・罠・隠れたボス）' },
  informant: { name: '情報屋の常連', desc: '情報の値段が半分' },
  insurance: { name: '闇の保険', desc: '隊員が死ぬたびに1,500cr' },
  scavenger: { name: '拾い屋', desc: '依頼に成功するたびに+300cr' },
  nightBroker: { name: '夜の顔役', desc: '顔見せの候補+1、契約金−30%' },
  brokenConscience: { name: '壊れた良心', boss: true, desc: '義体の人間性コスト−1（最低1）', weak: '隠れ家で人間性が戻らない' },
  bloodOath: { name: '血の誓い', boss: true, desc: '全員の射撃+1', weak: '依頼のたびに、送り出した人の人間性−1' },
  backer: { name: '企業の後ろ盾', boss: true, desc: '依頼の報酬+20%', weak: '依頼のたびに、標的の社のヒート+5' },
  ironDiscipline: { name: '鉄の規律', boss: true, desc: '不安定な人が動揺しない', weak: '路地裏の候補が2人になる' },
};

/* フェーズ表の記法 */
const _ = null;
const H = (p) => Object.assign(p, { hidden: true });
const S = (dv, l) => ({ t: 'sneak', dv, l });
const T = (dv, l) => ({ t: 'trap', dv, l });
const C = (n, l, enemyType = 'standard', enemyDV) => ({ t: 'combat', n, l, enemyType, ...(enemyDV ? { enemyDV } : {}) });
const R = (l) => ({ t: 'rest', l });
const GT = (dv, l) => ({ t: 'gate', dv, l });
const O = (l) => ({ t: 'goal', l });
const E = (dv, l) => ({ t: 'escape', dv, l });
const D = (dv, l) => ({ t: 'drive', dv, l });
const K = (dv, l) => ({ t: 'talk', dv, l });
const M = (dv, l) => ({ t: 'med', dv, l });
const B = (l) => ({ t: 'boss', l });
const BS = (boss, l) => ({ t: 'boss', boss, l }); // ローグライク版の幕のボス（RUN_BOSSES のキー）
const I = (dv, l, fx) => ({ t: 'ice', dv, l, fx });
const N5 = () => [_, _, _, _, _];
const N10 = () => [_, _, _, _, _, _, _, _, _, _];

const ICE_FX = {
  cam: '失敗で次の交戦に敵+1',
  door: '失敗で次の扉のDV+4',
  alarm: '失敗で逃走が追撃戦に',
  trace: '失敗でヒート+6',
  data: '目標。失敗で撤退',
};

const INTEL_COST = { 1: 200, 2: 500, 3: 900 };
const RANK_CRED = { 1: 25, 2: 60 };
const RANK_NAME = { 1: '路地裏', 2: '港湾', 3: '上層' };

const JOBS = [
  /* ── 評判ランク1 ── */
  {
    id: 'r1_delivery', rank: 1, district: 'harbor', title: '屋台街から港湾倉庫へ荷を運ぶ', client: 'resident', target: null,
    nights: 1, payout: 2000, cred: 4, heat: 0, req: [],
    desc: '中身は聞かない約束の小包。白蛇会の縄張りを抜けて届ける。',
    routes: [
      { name: '表通り', note: '検問はあるが見通しがいい', field: [D(15, '検問'), _, C(1, 'チンピラ'), _, O('受け渡し')], net: N5() },
      { name: '裏路地', note: '近道。誰の縄張りかは曖昧', field: [S(15, '裏路地'), H(C(2, '白蛇会の見張り')), _, _, O('受け渡し')], net: N5() },
    ],
  },
  {
    id: 'r1_collect', rank: 1, district: 'street', title: '白蛇会の取り立てを代行する', client: 'gang', target: null,
    nights: 1, payout: 2400, cred: 4, heat: 0, req: [],
    desc: '払いの滞った闇カジノから、上がりを回収してくる。',
    routes: [
      { name: '正面', note: '話がこじれれば殴り合い', field: [K(15, '支配人と交渉'), _, H(C(2, '用心棒')), _, O('金庫から回収')], net: N5() },
      { name: '裏口', note: '警報線が張ってあるという噂', field: [S(15, '裏口'), H(T(15, '警報線')), C(1, '番犬'), _, O('金庫から回収')], net: N5() },
    ],
  },
  {
    id: 'r1_watch', rank: 1, district: 'street', title: '屋台街の夜警', client: 'resident', target: null,
    nights: 1, payout: 1800, cred: 3, heat: 0, req: [],
    desc: '最近、屋台を荒らす強盗がいる。朝まで店を守ってほしい。',
    routes: [
      { name: '見回り', note: '歩き回って数を減らす', field: [_, C(2, '強盗'), R('屋台の裏で休憩'), H(C(2, '強盗の仲間')), O('朝まで守る')], net: N5() },
      { name: '待ち伏せ', note: '来るのを待って一度に叩く', field: [S(15, '物陰に潜む'), _, H(C(3, '強盗団')), _, O('朝まで守る')], net: N5() },
    ],
  },
  {
    id: 'r1_cargo', rank: 1, district: 'harbor', title: 'ミツカネの積み荷を取り返す', client: 'mitsukane', target: null,
    nights: 1, payout: 2600, cred: 4, heat: 0, req: ['driver'],
    desc: '港で密輸屋に抜かれた部品箱。警察沙汰にはしたくないらしい。',
    routes: [
      { name: '倉庫街', note: '密輸屋の溜まり場を通る', field: [S(15, '倉庫街'), C(2, '密輸屋'), _, O('積み荷'), E(15, '逃走')], net: N5() },
      { name: '水路', note: '船で裏から近づく', field: [D(15, '水路'), H(T(15, '浮遊機雷')), _, O('積み荷'), E(15, '逃走')], net: N5() },
    ],
  },
  {
    id: 'r1_relay', rank: 1, district: 'street', title: 'ヴェルデの監視網に中継器を仕込む', client: 'hakurou', target: 'verde',
    nights: 1, payout: 2400, cred: 4, heat: 6, req: ['net'],
    desc: 'ハクロウ通信の下請け。製薬工場の外周カメラに穴をあける。',
    routes: [
      { name: '外周フェンス', note: 'カメラの死角を縫う', field: [S(15, 'フェンス越え'), _, H(C(1, '巡回警備')), O('中継器を設置'), _], net: [_, I(15, 'カメラ網', 'cam'), _, I(15, '中継器の接続', 'data'), _] },
      { name: '下水道', note: '人目はないが空気が悪い', field: [_, H(T(15, 'ガス溜まり')), _, O('中継器を設置'), S(15, '撤収')], net: [I(15, 'センサー網', 'trace'), _, _, I(15, '中継器の接続', 'data'), _] },
    ],
  },
  {
    id: 'r1_escort', rank: 1, district: 'harbor', title: 'ミツカネの技術者を送り届ける', client: 'mitsukane', target: null,
    nights: 1, payout: 2600, cred: 4, heat: 0, req: [],
    desc: '転勤する技術者を湾岸の社宅まで。狙われる心当たりはないと本人は言う。',
    routes: [
      { name: '湾岸道路', note: '速いが目立つ', field: [D(15, '渋滞の湾岸道路'), H(C(2, '襲撃者')), _, C(1, 'バイク乗り'), O('送り届ける')], net: N5() },
      { name: '旧市街', note: '遅いが隠れやすい', field: [S(15, '旧市街'), _, R('セーフハウス'), H(C(2, '狙撃手と相棒')), O('送り届ける')], net: N5() },
    ],
  },

  {
    id: 'r1_memory', rank: 1, district: 'street', title: '盗まれた記憶テープを取り戻す', client: 'resident', target: null,
    nights: 1, payout: 2200, cred: 4, heat: 0, req: [],
    desc: '亡くなった夫の記憶を焼いたテープが、質屋に流れた。夫の声を聞けるのは、もうあれだけだという。',
    routes: [
      { name: '質屋', note: '主人と話をつける。こじれれば用心棒が出てくる', field: [K(15, '質屋の主人と交渉'), _, H(C(2, '質屋の用心棒')), _, O('記憶テープ')], net: N5() },
      { name: '裏口', note: '閉店後に忍び込む', field: [S(15, '質屋の裏口'), H(T(15, '防犯ワイヤー')), _, C(1, '寝ずの店番'), O('記憶テープ')], net: N5() },
    ],
  },
  {
    id: 'r1_neon', rank: 1, district: 'street', title: '白蛇会のネオン看板を乗っ取る', client: 'hakurou', target: 'gang',
    nights: 1, payout: 2400, cred: 4, heat: 0, req: ['net'],
    desc: 'ハクロウ通信が、屋台街でいちばん目立つ看板の広告枠を欲しがっている。持ち主は白蛇会だ。',
    routes: [
      { name: '屋上', note: '看板の裏から直接つなぐ', field: [S(15, '看板の裏へ登る'), _, H(C(2, '白蛇会の見回り')), _, S(15, '撤収')], net: [I(15, '監視カメラ', 'cam'), I(15, '看板の制御', 'data'), _, _, _] },
      { name: '配電盤', note: '路地の配電盤から回線に入る', field: [_, H(T(15, '漏電した配電盤')), _, C(1, '白蛇会の電気屋'), _], net: [_, _, I(15, '看板の制御', 'data'), _, _] },
    ],
  },
  {
    id: 'r1_parts_delivery', rank: 1, district: 'street', title: '闇医者に義体パーツを届ける', client: 'resident', target: null,
    nights: 1, payout: 2000, cred: 3, heat: 0, req: ['driver'],
    desc: '冷却箱の中身は、まだ温かい人工神経。出どころは聞かないほうがいい。',
    routes: [
      { name: '夜市を抜ける', note: '人混みに紛れる。義体狩りも紛れている', field: [D(15, '夜市の人混み'), _, H(C(2, '義体狩り')), _, O('闇医者に届ける')], net: N5() },
      { name: '旧地下鉄', note: '水の溜まった廃線を歩く', field: [S(15, '旧地下鉄'), H(T(15, '崩れた天井')), _, C(1, '地下の住人'), O('闇医者に届ける')], net: N5() },
    ],
  },

  /* ── 評判ランク2 ── */
  {
    id: 'r2_sample', rank: 2, district: 'harbor', title: 'ヴェルデ製薬の冷蔵倉庫からサンプルを回収する', client: 'mitsukane', target: 'verde',
    nights: 2, payout: 8000, cred: 7, heat: 12, req: ['net', 'tech', 'driver'],
    desc: '港湾倉庫の地下にある冷蔵庫から、試験中の義体用ジェルを一箱。',
    routes: [
      {
        name: '排水路', note: '情報屋いわく、警備の薄い裏道',
        field: [S(13, '侵入'), _, C(2, '巡回', 'armored', 19), _, H(T(13, 'センサー罠')), R('物陰で休息'), GT(15, '隔壁'), H(C(3, '警備ドローン', 'sniper', 19)), O('保管庫'), E(15, '逃走')],
        net: [_, I(13, 'カメラ網', 'cam'), _, _, _, _, I(15, '隔壁制御', 'door'), _, H(I(17, '警報系', 'alarm')), _],
      },
      {
        name: '搬入口', note: '業者に化けて正面から入る',
        field: [K(15, '偽の搬入業者'), H(C(2, '検品係の警備', 'hacker', 19)), _, GT(13, '搬入ゲート'), _, C(3, '倉庫警備', 'swarm', 17), _, GT(15, '冷蔵庫'), O('保管庫'), E(15, '逃走')],
        net: [I(13, '入構記録', 'trace'), _, _, I(15, 'ゲート制御', 'door'), _, _, I(15, 'カメラ網', 'cam'), _, H(I(17, '警報系', 'alarm')), _],
      },
    ],
  },
  {
    id: 'r2_defector', rank: 2, district: 'street', title: 'ヴェルデの研究者を亡命させる', client: 'hakurou', target: 'verde',
    nights: 1, payout: 6000, cred: 7, heat: 12, req: ['driver', 'med'],
    desc: '研究者本人は乗り気だが、体に追跡タグが埋めてある。',
    routes: [
      { name: '研究棟', note: '夜勤明けを狙う', field: [S(15, '研究棟'), H(C(2, '研究棟の狙撃班', 'sniper', 19)), K(13, '研究者を説得'), O('研究者を確保'), E(15, '逃走')], net: [I(13, 'カメラ網', 'cam'), _, _, H(I(15, '追跡タグ', 'trace')), _] },
      { name: '往診', note: '医者を装って社宅を訪ねる', field: [M(13, '往診を装う'), H(C(2, '社宅の狙撃班', 'sniper', 21)), M(15, '追跡タグの摘出'), O('研究者を確保'), E(13, '逃走')], net: [_, I(13, '社宅の入館系', 'trace'), _, _, _] },
    ],
  },
  {
    id: 'r2_datatheft', rank: 2, district: 'upper', title: 'ハクロウ通信のサーバーからデータを抜く', client: 'verde', target: 'hakurou',
    nights: 1, payout: 5500, cred: 7, heat: 12, req: ['net', 'tech'],
    desc: '物理的に端子を挿さないと届かない、隔離されたサーバー。',
    routes: [
      { name: '通用口', note: '物理で入ってネットで抜く', field: [S(15, 'データセンター'), GT(15, 'サーバー室'), H(C(2, '警備', 'sniper', 20)), O('物理接続'), E(13, '撤収')], net: [I(15, '外周ICE', 'trace'), _, I(15, 'カメラ網', 'cam'), I(17, 'データ金庫', 'data'), H(I(17, '黒ICE', 'alarm'))] },
      { name: '屋上', note: '空調設備から降りる', field: [D(13, 'ドローンで屋上へ'), H(T(15, '赤外線網')), GT(13, '空調ダクト'), O('物理接続'), C(2, '駆けつけた警備', 'hacker', 20)], net: [_, I(15, 'カメラ網', 'cam'), _, I(17, 'データ金庫', 'data'), _] },
    ],
  },
  {
    id: 'r2_convoy', rank: 2, district: 'harbor', title: 'ミツカネの兵器輸送を護衛する', client: 'mitsukane', target: null,
    nights: 2, payout: 7000, cred: 7, heat: 0, req: ['driver', 'solo'],
    desc: '湾岸から内陸の倉庫まで、二晩かけて運ぶ。狙っている連中は多い。',
    routes: [
      { name: '湾岸道路', note: '見通しがよく、待ち伏せもされやすい', field: [D(13, '湾岸道路'), _, H(C(3, '待ち伏せ', 'swarm', 17)), _, R('中継地点'), D(15, '高架'), C(2, 'ドローン', 'armored', 19), _, H(C(3, '白蛇会の襲撃', 'sniper', 19)), O('引き渡し')], net: N10() },
      { name: '旧線路', note: '廃線を走る。車は傷む', field: [D(15, '廃線'), H(T(13, '崩れた陸橋')), _, C(2, '線路の住人', 'hacker', 21), R('廃駅'), _, D(15, 'トンネル'), H(C(3, '先回りした襲撃者', 'swarm', 17)), _, O('引き渡し')], net: N10() },
    ],
  },

  {
    id: 'r2_ai', rank: 2, district: 'harbor', title: 'ハクロウ通信から逃げたAIを捕まえる', client: 'hakurou', target: 'mitsukane',
    nights: 1, payout: 6500, cred: 7, heat: 12, req: ['net', 'tech'],
    desc: '研究用のAIが回線を伝って、ミツカネの工場ネットに逃げ込んだ。捕獲要請に、AIは「消さないで」とだけ返してきた。',
    routes: [
      { name: '工場ネット', note: '物理端子から追い込む', field: [S(15, '工場の通用口'), _, C(2, '工場警備', 'hacker', 19), GT(15, 'サーバー区画'), O('AIを隔離')], net: [I(15, '工場のICE', 'trace'), _, I(15, 'AIの防壁', 'door'), I(19, 'AIの核', 'data'), _] },
      { name: '交渉', note: 'AIと話をつけて、自分から檻に入らせる', field: [K(15, 'AIと交渉'), H(C(2, 'ミツカネの回収班', 'armored', 19)), GT(15, '端末室'), O('AIを隔離'), E(15, '撤収')], net: [_, I(15, 'カメラ網', 'cam'), _, I(19, 'AIの核', 'data'), _] },
    ],
  },
  {
    id: 'r2_seized', rank: 2, district: 'harbor', title: '差し押さえられた義体を取り戻す', client: 'resident', target: 'verde',
    nights: 1, payout: 6000, cred: 7, heat: 12, req: ['solo', 'driver'],
    desc: 'ヴェルデの回収業者が、ローンの滞った住民の義足を「体ごと」持っていった。本人は港の倉庫にいる。',
    routes: [
      { name: '倉庫', note: '回収品の保管倉庫に忍び込む', field: [S(15, '回収業者の倉庫'), C(2, '倉庫番', 'swarm', 19), H(T(15, '圧力センサー')), O('差し押さえ品と本人'), E(17, '逃走')], net: N5() },
      { name: '回収車', note: '移送中の車を止める', field: [D(17, '回収車を追う'), H(C(3, '回収車の護衛', 'sniper', 21)), _, O('差し押さえ品と本人'), E(17, '逃走')], net: N5() },
    ],
  },

  /* ── 評判ランク3 ── */
  {
    id: 'r3_vault', rank: 3, district: 'upper', title: '上層：ミツカネ重役の金庫を開ける', client: 'verde', target: 'mitsukane',
    nights: 2, payout: 16000, cred: 12, heat: 20, req: ['net', 'tech', 'driver', 'solo'],
    desc: '企業区画の上層、重役フロアの壁金庫。中身は契約書の原本。',
    routes: [
      {
        name: '業務用エレベーター', note: '清掃業者の時間帯に紛れる',
        field: [S(17, '上層エレベーター'), C(3, '警備部隊'), H(T(15, '圧力床')), GT(17, '重役フロア'), R('空調ダクト'), H(C(4, '戦闘用義体兵')), GT(17, '金庫'), O('金庫の中身'), _, E(17, '屋上から逃走')],
        net: [I(15, '入館系', 'trace'), I(17, 'カメラ網', 'cam'), _, I(17, 'フロア制御', 'door'), _, _, I(19, '金庫制御', 'door'), _, H(I(19, '警報系', 'alarm')), _],
      },
      {
        name: '外壁', note: 'ビルの外を登る。逃げ道は空だけ',
        field: [D(15, '飛行車で接近'), H(T(17, '外壁の対人センサー')), GT(15, '窓'), _, R('空き会議室'), C(3, '巡回'), GT(17, '金庫'), O('金庫の中身'), H(C(3, '即応部隊')), E(17, '飛び降りて回収')],
        net: [_, I(17, 'センサー網', 'trace'), I(15, '窓の施錠', 'door'), _, _, I(17, 'カメラ網', 'cam'), I(19, '金庫制御', 'door'), _, _, H(I(19, '警報系', 'alarm'))],
      },
    ],
  },
  {
    id: 'r3_relay', rank: 3, district: 'harbor', title: 'ハクロウ通信の湾岸中継局を落とす', client: 'mitsukane', target: 'hakurou',
    nights: 2, payout: 14000, cred: 12, heat: 20, req: ['net', 'solo', 'driver'],
    desc: '街の半分の回線が通る中継局。一晩だけ黙らせてほしい。',
    routes: [
      {
        name: '海側', note: 'ボートで桟橋から',
        field: [D(15, '夜の湾'), C(3, '桟橋の警備'), _, H(T(15, '水中センサー')), R('機械室'), S(17, '制御棟'), H(C(4, '防衛ドローン')), _, O('中継器を停止'), E(15, '海へ逃走')],
        net: [_, I(15, 'カメラ網', 'cam'), _, _, _, I(17, '入館系', 'trace'), _, I(19, '中継局の中枢', 'data'), H(I(19, '警報系', 'alarm')), _],
      },
      {
        name: '陸側', note: '整備車両に紛れる',
        field: [K(15, '整備員を装う'), _, H(C(3, '詰所の警備')), GT(15, '制御棟'), R('倉庫'), _, C(3, '巡回'), H(T(17, '電磁床')), O('中継器を停止'), E(17, '検問を突破')],
        net: [I(15, '作業記録', 'trace'), _, _, I(17, '扉の制御', 'door'), _, _, I(17, 'カメラ網', 'cam'), _, I(19, '中継局の中枢', 'data'), H(I(19, '警報系', 'alarm'))],
      },
    ],
  },
  {
    id: 'r3_soul', rank: 3, district: 'upper', title: '上層：記憶銀行から一人分の人格を引き出す', client: 'gang', target: 'hakurou',
    nights: 2, payout: 15000, cred: 12, heat: 20, req: ['net', 'solo', 'tech'],
    desc: '白蛇会の会長が、十年前に死んだ兄の人格バックアップを欲しがっている。ハクロウの記憶銀行は、遺族にも開示しない。',
    routes: [
      {
        name: '正面', note: '遺族を装って保管階まで上がる',
        field: [K(17, '遺族を装う'), _, H(C(3, '銀行の警備')), GT(17, '保管階'), R('待合室'), S(17, '保管庫の通路'), H(C(4, '防衛義体兵')), GT(19, '人格保管庫'), O('人格データ'), E(17, '撤収')],
        net: [I(15, '受付系', 'trace'), _, I(17, 'カメラ網', 'cam'), I(17, '保管階の施錠', 'door'), _, _, _, I(19, '保管庫の施錠', 'door'), H(I(19, '警報系', 'alarm')), _],
      },
      {
        name: '回線', note: '保守用の中継室から中枢へ潜る',
        field: [_, S(17, '中継室へ'), _, C(3, '保守要員の護衛'), R('中継室'), _, H(T(17, '電磁床')), _, O('人格データ'), E(17, '撤収')],
        net: [I(17, '外周ICE', 'trace'), I(17, 'カメラ網', 'cam'), _, _, _, I(19, '記憶銀行の中枢', 'data'), _, H(I(19, '黒ICE', 'alarm')), _, _],
      },
    ],
  },
  // 1幕10夜にしたときに足した依頼。ランク2は4件、ランク3は6件（大仕事の前の夜にも置けるよう、ほとんど1夜）
  {
    id: 'r2_dockstrike', rank: 2, district: 'harbor', title: '港の詰所からスト破りを追い出す', client: 'resident', target: 'mitsukane',
    nights: 1, payout: 5500, cred: 7, heat: 12, req: ['solo'],
    desc: 'ミツカネが雇ったスト破りが、港の詰所に居座っている。労組は、夜明けまでに追い出してほしいと言う。',
    routes: [
      { name: '正面', note: '詰所に乗り込む', field: [S(15, '詰所の裏手'), C(3, 'スト破り', 'swarm', 17), K(15, '雇い主の名前を吐かせる'), O('詰所を取り戻す'), E(13, '港から離れる')], net: [I(13, '港のカメラ網', 'cam'), _, _, _, _] },
      { name: 'はしけ', note: '海側から横づけする', field: [D(15, 'はしけで横づけ'), H(C(2, '見張り', 'sniper', 19)), C(2, 'スト破りの頭', 'armored', 17), O('詰所を取り戻す'), E(15, 'はしけで撤収')], net: N5() },
    ],
  },
  {
    id: 'r2_med_delivery', rank: 2, district: 'street', title: '屋台街の闇病院に横流しの薬を届ける', client: 'gang', target: 'verde',
    nights: 1, payout: 5000, cred: 7, heat: 12, req: ['driver'],
    desc: 'ヴェルデの倉庫から流れた抗拒絶剤。箱に追跡タグが埋めてあるかもしれない。',
    routes: [
      { name: '地下道', note: '裏道を車で抜ける', field: [D(15, '地下道を抜ける'), H(T(15, '追跡タグ')), C(2, '回収班', 'standard', 18), O('薬を届ける'), E(13, '散る')], net: [_, I(15, '追跡タグ', 'trace'), _, _, _] },
      { name: '屋台の荷車', note: '人混みに紛れて運ぶ', field: [S(15, '屋台の人混み'), K(15, '検問をやり過ごす'), H(C(2, '検問の私兵', 'hacker', 19)), O('薬を届ける'), E(15, '屋台街から離脱')], net: [_, _, I(15, '検問の照会', 'trace'), _, _] },
    ],
  },
  {
    id: 'r2_drone', rank: 2, district: 'harbor', title: 'ハクロウの配送ドローンを乗っ取る', client: 'gang', target: 'hakurou',
    nights: 1, payout: 6000, cred: 7, heat: 12, req: ['net'],
    desc: '港の上を飛ぶ配送ドローンの鍵を、白蛇会が欲しがっている。',
    routes: [
      { name: '管制塔', note: '倉庫街の管制室に入る', field: [S(15, '倉庫街の管制塔'), GT(15, '管制室'), H(C(2, '管制の警備', 'sniper', 19)), O('ドローンの鍵'), E(15, '撤収')], net: [I(15, '外周ICE', 'trace'), I(15, '管制系', 'door'), _, _, H(I(17, '警報系', 'alarm'))] },
      { name: '墜落', note: '1機を落として回収する', field: [D(15, 'ドローンを追う'), C(3, '回収に来た群れ', 'swarm', 17), _, O('機体を回収'), E(15, '港から逃走')], net: [I(15, '飛行制御', 'cam'), _, _, _, _] },
    ],
  },
  {
    id: 'r2_arena', rank: 2, district: 'street', title: '地下闘技場の八百長を潰す', client: 'resident', target: 'gang',
    nights: 1, payout: 6000, cred: 7, heat: 12, req: ['solo', 'med'],
    desc: '白蛇会の胴元が、選手に薬を盛って負けさせている。住民の賭け金が消えていく。',
    routes: [
      { name: '観客席', note: '賭け屋に紛れて控室へ', field: [K(15, '賭け屋に紛れる'), S(15, '控室へ'), C(2, '用心棒', 'armored', 18), O('薬物の証拠'), E(13, '人波に紛れる')], net: [_, I(15, '賭けの記録', 'trace'), _, _, _] },
      { name: 'リング', note: '選手を診て薬を抜く', field: [M(15, '選手の薬を抜く'), H(C(3, '白蛇会の若い衆', 'swarm', 17)), K(17, '胴元を黙らせる'), O('八百長の証拠'), E(15, '裏口から撤収')], net: N5() },
    ],
  },
  {
    id: 'r3_elevator', rank: 3, district: 'upper', title: '上層：軌道エレベーターの貨物籠を止める', client: 'hakurou', target: 'mitsukane',
    nights: 1, payout: 9500, cred: 10, heat: 16, req: ['tech', 'solo'],
    desc: 'ミツカネの貨物籠が、軌道へ何かを上げようとしている。一晩だけ止めればいい。',
    routes: [
      { name: '整備路', note: '整備用シャフトを登る', field: [S(17, '整備用シャフト'), GT(17, '制動装置'), C(3, '警備部隊', 'armored'), O('籠を止める'), E(17, 'シャフトを降りる')], net: [I(17, '外周ICE', 'trace'), I(17, '制動系', 'door'), _, H(I(19, '警報系', 'alarm')), _] },
      { name: '貨物', note: '荷主になりすます', field: [K(17, '荷主になりすます'), H(C(3, '荷の護衛', 'sniper')), GT(19, '貨物籠の錠'), O('籠を止める'), E(17, '撤収')], net: [I(17, '荷主照会', 'trace'), _, I(19, '籠の制御', 'door'), _, _] },
    ],
  },
  {
    id: 'r3_board', rank: 3, district: 'upper', title: '上層：取締役会の議事録を差し替える', client: 'verde', target: 'hakurou',
    nights: 1, payout: 10000, cred: 10, heat: 16, req: ['net', 'tech'],
    desc: 'ハクロウの取締役会が、ある合併を決めた夜の記録。中身を一行だけ書き換える。',
    routes: [
      { name: '会議室', note: '役員フロアに入る', field: [S(17, '役員フロア'), C(3, '役員警護', 'sniper'), GT(17, '会議室'), O('議事録を差し替える'), E(17, '撤収')], net: [I(17, '入館系', 'trace'), I(17, 'カメラ網', 'cam'), _, H(I(19, '警報系', 'alarm')), _] },
      { name: '清掃', note: '清掃業者を装う', field: [K(17, '清掃業者を装う'), H(T(17, '圧力床')), GT(17, '役員室'), O('議事録を差し替える'), E(15, '清掃車で撤収')], net: [_, I(17, '床センサー', 'cam'), I(19, '役員室の錠', 'door'), _, _] },
    ],
  },
  {
    id: 'r3_doctor', rank: 3, district: 'upper', title: '上層：連れ去られた闇医者を取り戻す', client: 'resident', target: 'verde',
    nights: 1, payout: 9000, cred: 10, heat: 16, req: ['med', 'driver'],
    desc: '屋台街の闇医者が、ヴェルデの隔離病棟に連れていかれた。治験の「協力者」として。',
    routes: [
      { name: '病棟', note: '隔離病棟に忍び込む', field: [S(17, 'ヴェルデの隔離病棟'), C(3, '病棟の警備', 'hacker'), M(17, '拘束具を外す'), O('闇医者を確保'), E(17, '救急車で離脱')], net: [I(17, '病棟のICE', 'trace'), _, _, H(I(19, '警報系', 'alarm')), _] },
      { name: '移送車', note: '移送の途中で奪う', field: [D(17, '移送車を追う'), C(4, '護送の私兵', 'swarm'), _, O('闇医者を確保'), E(17, '振り切る')], net: N5() },
    ],
  },
  {
    id: 'r3_core', rank: 3, district: 'upper', title: '上層：暴走したAIの中枢を焼く', client: 'mitsukane', target: 'hakurou',
    nights: 1, payout: 10500, cred: 10, heat: 16, req: ['net'],
    desc: 'ハクロウのデータ聖堂で、管理AIが自分を守りはじめた。止められるのは今夜だけ。',
    routes: [
      { name: '中枢', note: 'データ聖堂に入る', field: [S(17, 'データ聖堂'), H(C(3, 'AIの防衛ドローン', 'sniper')), GT(19, '冷却室'), O('中枢を焼く'), E(17, '撤収')], net: [I(19, '自己防衛ICE', 'trace'), _, I(19, '冷却制御', 'door'), _, H(I(21, '警報系', 'alarm'))] },
      { name: '電源', note: '変電所から電源を落とす', field: [S(17, '変電所'), C(3, '保守部隊', 'armored'), T(17, '高圧線'), O('電源を落とす'), E(17, '撤収')], net: [_, I(17, '変電所の制御', 'cam'), _, _, _] },
    ],
  },
  {
    id: 'r3_cash_convoy', rank: 3, district: 'upper', title: '上層：現金輸送車を襲う', client: 'gang', target: 'mitsukane',
    nights: 1, payout: 11000, cred: 10, heat: 16, req: ['driver', 'solo'],
    desc: '企業区画を回るミツカネの現金輸送車。白蛇会が、帳簿に載らない金を欲しがっている。',
    routes: [
      { name: '高架', note: '高架で並走して乗り移る', field: [D(17, '高架で追いつく'), C(3, '輸送車の護衛', 'armored'), D(19, '並走して乗り移る'), O('現金'), E(17, '高架から離脱')], net: [I(17, '交通管制', 'cam'), _, _, _, _] },
      { name: '待ち伏せ', note: '料金所で止める', field: [S(17, '料金所'), H(T(17, '追跡装置')), C(4, '輸送部隊', 'swarm'), O('現金'), E(19, '検問を突破')], net: [_, I(17, '追跡装置', 'trace'), _, _, _] },
    ],
  },
  {
    id: 'r3_garrison', rank: 3, district: 'upper', title: '上層：ミツカネ私兵の詰所を潰す', client: 'verde', target: 'mitsukane',
    nights: 2, payout: 15500, cred: 12, heat: 20, req: ['solo', 'tech', 'med'],
    desc: '企業区画の境に置かれたミツカネの私兵の詰所。二晩かけて、指揮系統ごと黙らせる。',
    routes: [
      {
        name: '正面', note: '夜勤の交代を狙う',
        field: [S(17, '私兵の詰所'), C(3, '夜勤の私兵', 'armored'), _, H(T(17, '自動銃座')), R('武器庫の陰'), GT(17, '司令室'), C(4, '即応部隊', 'sniper'), M(17, '負傷者の手当て'), O('指揮系統を断つ'), E(17, '撤収')],
        net: [_, I(17, 'カメラ網', 'cam'), _, I(17, '銃座の制御', 'door'), _, I(19, '司令室の扉', 'door'), _, _, H(I(19, '警報系', 'alarm')), _],
      },
      {
        name: '補給', note: '補給業者を装う',
        field: [K(17, '補給業者を装う'), _, H(C(3, '詰所の警備', 'hacker')), GT(17, '補給庫'), R('補給庫'), _, C(3, '巡回', 'sniper'), S(19, '司令室へ'), O('指揮系統を断つ'), E(19, '包囲を破る')],
        net: [I(17, '搬入記録', 'trace'), _, _, I(17, '補給庫の扉', 'door'), _, _, I(17, 'カメラ網', 'cam'), _, H(I(19, '警報系', 'alarm')), _],
      },
    ],
  },
];

/* 物語の章。ランでは箱の分岐（cipher）、各幕の大仕事の成功、夜明け（dawn）と結末に使う */
const CHAPTERS = {
  handover: {
    no: 1, title: '第1章　引き継ぎ',
    body: [
      '前任のフィクサー、ハシバが消えて三週間になる。',
      '湾岸の隠れ家と縄張り、40夜分の借金、それから開け方のわからない黒い箱が、新人のあなたに回ってきた。',
      'あなたは撃たない。ランナーを雇い、仕事を選び、夜の街へ送り出す。そして、人間のまま帰ってくるのを待つ。',
    ],
    goal: '依頼を3件成功させて、縄張りを回し始める。',
    next: 'cipher',
    advance: { successes: 3 },
  },
  cipher: {
    no: 2, title: '第2章　鍵を探す',
    body: [
      '仕事が回り始めた。ハシバの箱は、普通の端末では暗号の入り口すら見えない。',
      '開けるには腕のいいネットランナーと、港湾の仕事を受けられるだけの評判が要る。',
    ],
    goal: '評判ランク2になり、インターフェース6以上のネットランナーを抱える。',
    job: 'camp2',
    unlock: { rank: 2, netInterface: 6 },
    choice: {
      title: '誰の手を借りるか',
      body: [
        '箱の運送記録には、三社の社名が並んでいた。運ばれていた人の行き先を追うには、港湾局の乗船名簿が要る。',
        '名簿に近づくには、どこかの社の内側に手を借りるしかない。手を組んだ社は少しのあいだ目をつぶってくれるが、残りの二社は、こちらを敵と見なすだろう。',
      ],
      options: [
        { ally: 'mitsukane', next: 'cargo_mitsukane', text: '物流部長ナカガワは、港の夜警を外せる。腕の立つソロと、逃げ足のあるドライバーが要る仕事になる。' },
        { ally: 'verde', next: 'cargo_verde', text: '治験管理官は、名簿の人々の「その後」を知っている。ネットランナーとメドテックの仕事になる。' },
        { ally: 'hakurou', next: 'cargo_hakurou', text: '回線保守主任は、港湾局の電子目録に通じる回線を貸せる。ネットランナーとテックの仕事になる。' },
      ],
    },
  },
  cargo_mitsukane: {
    no: 3, title: '第3章　積み荷・鋼の手', ally: 'mitsukane',
    body: [
      '箱の中身の一部が読めた。運送記録だ。',
      'ただし、運ばれていたのは荷物ではなく人だった。ハシバは三社のあいだで、人を運んでいた。',
      'ミツカネ重工の物流部長ナカガワは、箱の記録に値段をつけなかった。「名簿の原本は、ヴェルデが検疫倉庫に隠している。取りに行くなら、港の夜警はこちらで外そう」',
    ],
    goal: '港湾局の乗船名簿を手に入れる。',
    next: 'drowned',
    job: 'camp3_mitsukane',
  },
  cargo_verde: {
    no: 3, title: '第3章　積み荷・緑の検疫', ally: 'verde',
    body: [
      '箱の中身の一部が読めた。運送記録だ。',
      'ただし、運ばれていたのは荷物ではなく人だった。ハシバは三社のあいだで、人を運んでいた。',
      'ヴェルデ製薬の治験管理官は、名簿に載った人々の「その後」を知っていると言った。「照合したいなら、ハクロウの医療回線に残る転送記録が要る」',
    ],
    goal: '港湾局の乗船名簿を手に入れる。',
    next: 'drowned',
    job: 'camp3_verde',
  },
  cargo_hakurou: {
    no: 3, title: '第3章　積み荷・白狼の回線', ally: 'hakurou',
    body: [
      '箱の中身の一部が読めた。運送記録だ。',
      'ただし、運ばれていたのは荷物ではなく人だった。ハシバは三社のあいだで、人を運んでいた。',
      'ハクロウ通信の回線保守主任は、港湾局の電子目録に通じる保守回線を貸すと言った。見返りは、名簿に載ったミツカネの物流記録の写しだ。',
    ],
    goal: '港湾局の乗船名簿を手に入れる。',
    next: 'drowned',
    job: 'camp3',
  },
  drowned: {
    no: 4, title: '第4章　沈む名前',
    body: [
      '名簿に載っていた名前を、ひとつずつ洗った。ほとんどは死亡記録か、記録そのものが消えていた。',
      'ただ一人、水没区の集落で生きている男がいた。三社のあいだを五回「貸し出され」、そのたびに記憶を消されたという。',
      '回収屋より先に男を見つければ、名簿が何のための記録だったのか、本人の口から聞ける。',
    ],
    goal: '手がかりを洗い、名簿の生き残りを回収屋より先に水没区から連れ出す。',
    next: { ally: { mitsukane: 'coordinator_mitsukane', verde: 'coordinator_verde', hakurou: 'coordinator_hakurou' } },
    job: 'camp_names',
    unlock: { chapterNights: 2 },
    allyBody: {
      mitsukane: '男の左腕には、ミツカネの資産番号が刻印されていた。ナカガワは、その番号を見ても顔色を変えなかった。',
      verde: '男の首筋には、ヴェルデの治験用ポートが残っていた。管理官は「回収して記録を取りたい」とだけ言った。',
      hakurou: '男の網膜には、ハクロウの通信ログが焼きついていた。保守主任は、その中身を見せてくれと何度も頼んできた。',
    },
  },
  coordinator_mitsukane: {
    no: 5, title: '第5章　調整役・海上基地', ally: 'mitsukane',
    body: [
      '名簿の最後の行に、ハシバ自身の名前があった。行き先の欄は空白のままだ。',
      '名簿を持ち出したことは、もう知られている。3社すべてがこちらを嗅ぎ回り始めた。',
      '男の証言で、調整役の名前がわかった。ミツカネの警備部は、その居場所を三日で突き止めた。ハクロウの海上中継基地だ。「話を聞いたら、あとはこちらで処理する」とナカガワは言った。',
    ],
    goal: '評判ランク3になり、ハシバを消した「調整役」を問い詰める。（毎夜、全企業のヒート+3）',
    next: 'dawn',
    job: 'camp4_mitsukane',
    unlock: { rank: 3 },
    heatPerNight: 3,
  },
  coordinator_verde: {
    no: 5, title: '第5章　調整役・役員病棟', ally: 'verde',
    body: [
      '名簿の最後の行に、ハシバ自身の名前があった。行き先の欄は空白のままだ。',
      '名簿を持ち出したことは、もう知られている。3社すべてがこちらを嗅ぎ回り始めた。',
      '男の証言で、調整役の名前がわかった。ヴェルデの治験管理官によれば、調整役は偽名でミツカネの役員病棟に入院している。主治医の名義なら、ヴェルデが用意できるという。',
    ],
    goal: '評判ランク3になり、ハシバを消した「調整役」を問い詰める。（毎夜、全企業のヒート+3）',
    next: 'dawn',
    job: 'camp4_verde',
    unlock: { rank: 3 },
    heatPerNight: 3,
  },
  coordinator_hakurou: {
    no: 5, title: '第5章　調整役・上層の居室', ally: 'hakurou',
    body: [
      '名簿の最後の行に、ハシバ自身の名前があった。行き先の欄は空白のままだ。',
      '名簿を持ち出したことは、もう知られている。3社すべてがこちらを嗅ぎ回り始めた。',
      '男の証言で、調整役の名前がわかった。ハクロウの通信記録によれば、調整役はヴェルデ製薬の上層階に住んでいる。ハシバが最後に会った相手でもある。',
    ],
    goal: '評判ランク3になり、ハシバを消した「調整役」を問い詰める。（毎夜、全企業のヒート+3）',
    next: 'dawn',
    job: 'camp4',
    unlock: { rank: 3 },
    heatPerNight: 3,
  },
  dawn: {
    no: 6, title: '第6章　夜明け',
    body: [
      '調整役は白状した。三社は社員を互いに「貸し借り」していた。戻ってこなかった者の記録が、あの箱に入っている。',
      'ハシバは公表しようとして、三社の合意で消された。',
      '箱を持って朝を迎えれば、その行き先は自分で決められる。',
    ],
    goal: '最後の依頼を成功させ、箱の行き先を決める。',
    job: 'camp5',
    heatPerNight: 3,
    ending: true,
    allyBody: {
      mitsukane: 'ミツカネの警備艇は、約束の桟橋に来なかった。ナカガワも、箱の中身を知った以上は取り返す側に回った。',
      verde: 'ヴェルデの治験管理官からの連絡は、その夜を最後に途絶えた。病棟の主治医の名義は、もう使えない。',
      hakurou: 'ハクロウの保守回線は、夜のうちに遮断された。保守主任の番号は、もう誰にもつながらない。',
    },
  },
};

/* 幕間。条件を満たした夜明けに一度だけ流れる（条件は engine.js の INTERLUDE_WHEN） */
const INTERLUDES = {
  firstCyber: {
    title: '幕間　肉の値段',
    body: [
      '闇医者は、外した肉を銀色の袋に入れて、こちらに見せもせずに捨てた。',
      '「部品は替えがきく。替えがきかないのは、替えたと気づく心のほうだ」',
      '帰り道、新しい体のランナーは、屋台のガラスに映る自分を一度だけ振り返った。',
    ],
  },
  firstDeath: {
    title: '幕間　空いた寝台',
    body: [
      '隠れ家の寝台がひとつ空いた。毛布はたたまれないまま、まだ形を残している。',
      '屋台街では、帰ってこなかった者の名前を、軒先の提灯に書く習わしがある。',
      'あなたは名前を書いた。字は、思ったよりも震えなかった。それが少し怖かった。',
    ],
  },
  edge: {
    title: '幕間　鏡に映らない',
    body: [
      '夜中に目を覚ますと、ランナーの一人が洗面所の鏡の前に立っていた。',
      '「顔は映ってる。でも、これが自分だって、どこで判断してたんだっけ」',
      '人間性が尽きかけている。セラピーに通わせるか、それとも、あと一晩だけ働かせるか。',
    ],
  },
  harbor: {
    title: '幕間　港の匂い',
    body: [
      '港の顔役ゴンドウは、潮と機械油の匂いがする手で握手をした。',
      '「ハシバもここから始めた。あいつは最後まで、人を荷物みたいには運ばなかったよ」',
      'それが褒め言葉なのか警告なのか、あなたにはまだわからない。',
    ],
  },
  watched: {
    title: '幕間　見られている',
    body: [
      '隠れ家の向かいのビルに、三日前から同じ配送ドローンが停まっている。',
      '企業は、気に入らないフィクサーを訴えたりしない。ある朝、いなくなっているだけだ。',
      'ヒートが80を超えた。100になれば、隠れ家に人が来る。',
    ],
  },
  rain: {
    title: '幕間　雨はやまない',
    body: [
      'ヨミハマに来てから、晴れた夜を見た覚えがない。',
      '海面は毎年少しずつ上がり、下層の通りから順に水に沈んでいく。それでも夜市は、今夜も一段上の階で開いている。',
      'この街で長く生きるコツは、足元を見ないことだ。',
    ],
  },
  ghost: {
    title: '幕間　前任者の声',
    body: [
      '箱を開けた夜から、隠れ家の古い端末に、ときどき短い音声が届くようになった。',
      '「ランナーは道具じゃない。だが、道具のように扱わないと、守れないときがある」',
      'ハシバの声だ。録音なのか、誰かが真似ているのか。それとも、まだどこかで生きているのか。',
    ],
  },
};

/* 結末で、生き残ったランナーのその後を一行ずつ添える */
const EPILOGUES = {
  story: {
    kagerou: 'カゲロウの名前は、ハクロウのどの記録にも残っていない。本人がそうした。',
    yoru: 'ヨルは回収されなかった腕で、屋台街の子どもたちに射撃を教えている。',
    haruka: 'ハルカの診療所には、また灯がともった。今度は誰にも焼かせない。',
    shigure: 'シグレは取り戻した車で、夜明けの湾岸道路を一度だけ全開で走った。',
    mikoto: 'ミコトは、もう一人の自分に会いに行った。何を話したのかは、誰にも言わない。',
  },
  stable: ['{name}は、その後も夜の仕事を続けた。たまに隠れ家へ顔を出す。', '{name}は稼いだ金で、屋台を一軒買った。', '{name}は街を出た。絵葉書が一枚だけ届いた。'],
  unstable: ['{name}は鏡を避けるようになった。それでも、呼べば来る。', '{name}は眠らなくなった。眠る必要がなくなったのかもしれない。'],
  sign: ['{name}の義体は、たぶん本人より長く生きるだろう。', '{name}は自分の名前を、ときどき思い出せない。'],
};

const ENDINGS = {
  publish: {
    title: '公開する',
    pick: '評判は最大になるが、3社に追われる。',
    body: [
      '名簿は朝のニュースより早く街に広まった。戻ってこなかった人たちの名前が、屋台街の壁という壁に貼られた。',
      'あなたの名前を知らない者は、もうヨミハマにいない。そのかわり、隠れ家の扉を叩く音は一晩も止まない。',
    ],
  },
  sell: {
    title: '売る',
    pick: '大金が入るが、街は何も変わらない。',
    body: [
      'ハクロウ通信の代理人は、言い値を一度も値切らずに払った。',
      '口座には一生分のクレジット。湾岸のネオンは昨日と同じ色で光っている。ヨミハマは何も変わらない。',
    ],
  },
  burn: {
    title: '焼く',
    pick: '誰も得をしないが、ランナーたちは生き残る。',
    body: [
      '箱は港の焼却炉で灰になった。誰も得をしなかった。',
      'それでも翌朝、ランナーたちは全員、隠れ家に帰ってきた。今夜も仕事はある。',
    ],
  },
};

/* ───────── ローグライク版：幕のボスと大仕事 ───────── */

/* 幕のボス。強さはその幕の敵の基準値+2（DV・攻撃・ダメージ）。hits は耐久で、撤退して挑み直しても削った分は戻らない（護衛は戻る）
   escort：護衛（交戦の敵の種類と数。群れは2体多い）
   hidden：知覚DVで隠れ場所を見つけないと、現場から撃てない
   hack：ネット担当がインターフェース（ボスのDV）に成功するたび耐久−1。ice：毎ラウンド、ネット担当にICE攻撃
   deal：白蛇会との関係が rel 以上なら、説得で cost の取引に変えて交戦を避けられる
   attacks：1ラウンドに撃つ回数。seize：このラウンド数で倒しきれないと、目標を1つ持ち去る（次の逃走を追撃戦にして運転で振り切れば取り返せる）
   armored：テックか徹甲ライフルがないと、1発で耐久が1しか削れない（あれば2）
   commander：指揮官が乗っている。生きているあいだ、ほかの敵の攻撃+1。知覚 spot で見抜くと先に狙える
   drug：戦闘薬で攻撃+drug。talk：説得DVで正気に戻すと、撃たずに終わる
   layers：ネットのボス。黒ICEの層ごとのDV（失敗で逆流2d6）。cut：抜けなければ現場から回線を物理的に切る（電子DV、3回まで）
   tricks・ways：仕掛けと攻略の道。情報を買うと見える。drop：倒すと大仕事の報酬に混ざる品
   role・gender・look：地図と依頼に出す姿（肖像と義体の描き方） */
const RUN_BOSSES = {
  denki: {
    resist: 'net',
    name: '電気屋', role: 'net', gender: 'm', look: ['jack2', 'coproc2'], hits: 2,
    who: '白蛇会の電脳屋。ハシバが手放した箱の鍵を買い取っている。',
    escort: [{ type: 'swarm', n: 1, name: '白蛇会の用心棒' }],
    hidden: 17, hack: true, ice: true, noShoot: true, deal: { rel: 30, dv: 15, cost: 1000 },
    tricks: ['店の奥に隠れていて、現場からは見えない', '毎ラウンド、ネット担当にICE攻撃を仕掛けてくる（ネット担当がいなければ現場の誰かが2d6）'],
    ways: ['ネット：インターフェースで2回成功すると倒せる', '現場：知覚DV17で隠れ場所を見つければ、射撃で倒せる', '白蛇会との関係が+30以上なら、説得で1,000crの取引に変えられる'],
    drop: { gear: 'denkiDeck' },
  },
  kaname: {
    resist: 'fire',
    name: 'カナメ', role: 'solo', gender: 'f', look: ['optics2', 'arm2', 'reflex'], hits: 3,
    who: '三社のどれにも雇われる回収屋の頭。名簿に載った人を「回収」してきた。',
    escort: [{ type: 'sniper', n: 1, name: '回収班の狙撃手' }],
    attacks: 2, seize: 2,
    tricks: ['ソロ型の傭兵ランナー。1ラウンドに2回撃つ', '2ラウンドで倒しきれないと、目標を1つ持ち去る'],
    ways: ['持ち去られても、次の逃走が追撃戦になる。追手を退けて運転で振り切れば取り返せる', '狙撃手は知覚DV18で先に見つける'],
    drop: { cyber: 'kanameEye' },
  },
  hound: {
    resist: 'stealth',
    name: '鋼の番犬', role: 'solo', gender: 'm', look: ['plating3', 'arm2', 'heart2'], hits: 5,
    who: 'ミツカネの物流部長ナカガワの警備艇に乗る重装義体兵。',
    escort: [{ type: 'armored', n: 1, name: 'ミツカネの警備兵' }],
    armored: true, commander: { name: 'ナカガワ', spot: 18 },
    tricks: ['重装甲。テックか徹甲ライフルがないと、1発で耐久が1しか削れない', 'ナカガワが指揮官として乗っている。生きているあいだ、ほかの敵の攻撃+1'],
    ways: ['テックを連れていくか、徹甲ライフルを持たせる（1発で耐久2）', '知覚DV18でナカガワを見抜けば、先に落とせる'],
  },
  subject: {
    resist: 'chrome',
    name: '被検体', role: 'solo', gender: 'x', look: ['reflex3', 'heart2'], hits: 6,
    who: '名簿に載っていた一人。ヴェルデの治験管理官が、戦闘薬で動かしている。',
    escort: [{ type: 'swarm', n: 1, name: '検疫部隊' }],
    drug: 2, talk: 22,
    tricks: ['戦闘薬が毎ラウンド効いていて、攻撃+2'],
    ways: ['説得DV22で正気に戻せば、撃たずに終わる。そのときは結末の一行が変わる', 'メドテックがいれば、倒れた仲間の死亡セーブに+1'],
  },
  keeper: {
    resist: 'endure',
    name: '保守主任', role: 'net', gender: 'f', look: ['jack2', 'tacai2'], hits: 3,
    who: '箱を開ける回線を貸してくれた本人。箱の中身を、回線ごと消しに来る。',
    layers: [22, 23, 24], cut: 24,
    tricks: ['ネットのボス。黒ICEが3重（DV22・23・24）。失敗するたびに逆流2d6（防具無視）'],
    ways: ['腕のいいネットランナーと、ニューラル防壁（逆流を受けない）', 'ネットで抜けなければ、現場から回線を物理的に切る（電子DV24、3回まで）', '破った層は、挑み直しても戻らない'],
  },
};

/* 幕の大仕事。act は幕、ally は第1幕で組んだ社（第2幕・第3幕）。campaign は成功したときに進める章
   （cipher：組む社を選ぶ、cargo_*：沈む名前へ、dawn：箱の行き先を決める結末） */
const RUN_JOBS = {
  run_denki: {
    id: 'run_denki', act: 1, rank: 1, district: 'street', title: '電気屋から箱の鍵を取り返す', client: 'self', target: 'gang', campaign: 'cipher', boss: 'denki',
    nights: 1, payout: 1000, cred: 0, heat: 0, req: ['net'],
    desc: 'ハシバが手放した箱の鍵は、白蛇会の電脳屋「電気屋」が買い取っていた。屋台街の奥の店で、鍵を売る相手を待っている。',
    routes: [
      { name: '店の正面', note: '人混みに紛れて店に入る', field: [S(15, '屋台街の人混み'), C(1, '白蛇会の見張り', 'swarm'), _, BS('denki', '電気屋の店'), O('箱の鍵')], net: [I(15, '監視カメラ', 'cam'), _, _, _, _] },
      { name: '屋根づたい', note: '屋根を伝って店の裏に回る', field: [H(T(15, '屋根の鳴子')), _, R('給水塔の陰'), BS('denki', '電気屋の店'), O('箱の鍵')], net: [_, I(15, '屋根のカメラ', 'cam'), _, _, _] },
    ],
  },
  run_cargo_mitsukane: {
    id: 'run_cargo_mitsukane', act: 2, ally: 'mitsukane', rank: 2, district: 'harbor', title: '名簿の原本：ヴェルデの検疫倉庫', client: 'self', target: 'verde', campaign: 'cargo_mitsukane', boss: 'kaname',
    nights: 1, payout: 3000, cred: 0, heat: 10, req: ['solo', 'driver'],
    desc: 'ミツカネの警備部が、港の夜警を一晩だけ外してくれる。名簿の原本はヴェルデの検疫倉庫にある。同じ夜、回収屋のカナメも名簿を狙っている。',
    routes: [
      { name: '検疫倉庫', note: '正面から押し入る', field: [S(15, '検疫倉庫'), C(2, 'ヴェルデの検疫警備', 'standard', 17), O('名簿の原本'), BS('kaname', '回収屋の待ち伏せ'), E(15, '港から離脱')], net: N5() },
      { name: '検疫船', note: '沖に停めた検疫船に横づけする', field: [D(15, '検疫船に横づけ'), H(C(2, '船員に化けた私兵', 'swarm', 19)), O('名簿の原本'), BS('kaname', '回収屋の待ち伏せ'), E(17, '沖へ逃走')], net: N5() },
    ],
  },
  run_cargo_verde: {
    id: 'run_cargo_verde', act: 2, ally: 'verde', rank: 2, district: 'upper', title: '名簿の写し：ハクロウの医療回線', client: 'self', target: 'hakurou', campaign: 'cargo_verde', boss: 'kaname',
    nights: 1, payout: 3000, cred: 0, heat: 10, req: ['net', 'med'],
    desc: 'ヴェルデの治験管理官が、名簿と照合できる記録を渡すという。条件は、ハクロウの医療回線に残る転送記録。抜いた写しを、回収屋のカナメが待ち構えている。',
    routes: [
      { name: '医療回線', note: '治験の往診を装って端末に触れる', field: [M(15, '治験の往診を装う'), H(C(2, '回線警備', 'hacker', 19)), O('名簿の写し'), BS('kaname', '回収屋の待ち伏せ'), E(15, '救急車で離脱')], net: [I(15, '医療回線', 'trace'), _, I(15, '転送記録', 'data'), _, _] },
      { name: '保管庫', note: 'ハクロウの記録保管庫に忍び込む', field: [S(15, 'ハクロウの保管庫'), C(2, '保管庫の警備', 'sniper', 17), O('名簿の写し'), BS('kaname', '回収屋の待ち伏せ'), E(15, '撤収')], net: [_, I(15, 'カメラ網', 'cam'), I(15, '転送記録', 'data'), _, _] },
    ],
  },
  run_cargo_hakurou: {
    id: 'run_cargo_hakurou', act: 2, ally: 'hakurou', rank: 2, district: 'harbor', title: '名簿の原本：港湾局の記録庫', client: 'self', target: 'mitsukane', campaign: 'cargo_hakurou', boss: 'kaname',
    nights: 1, payout: 3000, cred: 0, heat: 10, req: ['net', 'tech'],
    desc: 'ハクロウの回線保守主任が、港湾局の電子目録への回線を貸してくれる。記録庫の原本を持ち出す夜、回収屋のカナメが出口で待っている。',
    routes: [
      { name: '記録庫', note: '港湾局の古い地下書庫', field: [S(15, '港湾局'), GT(15, '書庫の扉'), O('名簿の原本'), BS('kaname', '回収屋の待ち伏せ'), E(15, '撤収')], net: [I(15, 'カメラ網', 'cam'), I(15, '書庫の施錠', 'door'), I(17, '電子目録', 'data'), _, _] },
      { name: '荷役クレーン', note: 'クレーンで記録庫の屋上に降りる', field: [D(15, '荷役クレーンで屋上へ'), H(T(15, '古い警報')), O('名簿の原本'), BS('kaname', '回収屋の待ち伏せ'), E(15, '撤収')], net: [_, I(15, '警報系', 'alarm'), I(17, '電子目録', 'data'), _, _] },
    ],
  },
  run_box_mitsukane: {
    id: 'run_box_mitsukane', act: 3, ally: 'mitsukane', rank: 3, district: 'harbor', title: '箱を開ける：ナカガワの警備艇', client: 'self', target: 'mitsukane', campaign: 'dawn', boss: 'hound',
    nights: 1, payout: 0, cred: 0, heat: 0, req: ['solo'],
    desc: '箱の最後の層が開く夜、ミツカネの物流部長ナカガワが警備艇で乗りつけてきた。手を組んだ相手が、最後に立ちはだかる。',
    routes: [
      { name: '桟橋で迎え撃つ', note: '警備艇が着く前に先遣隊を叩く', field: [D(17, '湾岸の隠れ家へ急ぐ'), C(2, 'ミツカネの先遣隊', 'armored'), R('倉庫の陰'), BS('hound', '警備艇の甲板'), O('箱を開ける')], net: [I(17, '警備艇の通信', 'trace'), _, _, _, _] },
      { name: '船倉に乗り込む', note: '桟橋の下を回って警備艇に乗り移る', field: [S(17, '桟橋の下を回る'), H(T(17, '水中センサー')), GT(17, '警備艇の船倉'), BS('hound', '警備艇の甲板'), O('箱を開ける')], net: [_, _, I(17, '船倉の施錠', 'door'), _, _] },
    ],
  },
  run_box_verde: {
    id: 'run_box_verde', act: 3, ally: 'verde', rank: 3, district: 'upper', title: '箱を開ける：治験病棟の「被検体」', client: 'self', target: 'verde', campaign: 'dawn', boss: 'subject',
    nights: 1, payout: 0, cred: 0, heat: 0, req: ['med'],
    desc: '治験管理官は、箱の中身ごと名簿の人々を消すつもりだった。差し向けられたのは、戦闘薬で動かされている名簿の一人だ。',
    routes: [
      { name: '検疫部隊に紛れる', note: '防護服を着て病棟に入る', field: [M(17, '検疫部隊のふりをする'), C(2, '検疫部隊', 'swarm'), _, BS('subject', '隔離病室'), O('箱を開ける')], net: [I(17, '病棟のカメラ網', 'cam'), _, _, _, _] },
      { name: '裏口から', note: '薬品庫を抜けて隔離病室へ', field: [S(17, '治験病棟の裏口'), H(T(17, '検疫ガスの噴霧口')), R('薬品庫'), BS('subject', '隔離病室'), O('箱を開ける')], net: [_, I(17, '換気制御', 'cam'), _, _, _] },
    ],
  },
  run_box_hakurou: {
    id: 'run_box_hakurou', act: 3, ally: 'hakurou', rank: 3, district: 'upper', title: '箱を開ける：保守主任の回線', client: 'self', target: 'hakurou', campaign: 'dawn', boss: 'keeper',
    nights: 1, payout: 0, cred: 0, heat: 0, req: [],
    desc: '箱を開ける回線は、ハクロウの保守主任が貸してくれたものだった。最後の層が開く直前、その回線を通って、本人が中身を消しに来た。',
    routes: [
      { name: '回線保守棟', note: '保守主任のいる棟に乗り込む', field: [S(17, '回線保守棟'), C(2, '監視ドローン', 'sniper'), _, BS('keeper', '保守主任の回線'), O('箱を開ける')], net: [I(17, '保守棟のカメラ網', 'cam'), _, _, _, _] },
      { name: '湾岸中継局', note: '回線の途中にある中継局を押さえる', field: [D(17, '中継局へ'), H(C(2, '監視ドローン', 'sniper')), GT(17, '中継局の扉'), BS('keeper', '保守主任の回線'), O('箱を開ける')], net: [_, _, I(17, '中継局の施錠', 'door'), _, _] },
    ],
  },
};
