#!/usr/bin/env python3
# Generates TR/DE/FR/ZH/RU marketing pages matching EN/AR structure.
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

FLAGS = {
    "tr": '<svg viewBox="0 0 60 45" width="21" height="16" aria-hidden="true"><rect width="60" height="45" rx="2" fill="#E30A17"/><circle cx="23" cy="22.5" r="10" fill="#fff"/><circle cx="26.5" cy="22.5" r="8" fill="#E30A17"/><polygon fill="#fff" points="36.2,22.5 32.6,24.7 33.8,20.6 31,18.2 35.2,18.6 36.2,14.6 37.2,18.6 41.4,18.2 38.6,20.6 39.8,24.7"/></svg>',
    "de": '<svg viewBox="0 0 60 45" width="21" height="16" aria-hidden="true"><rect width="60" height="15" fill="#000"/><rect y="15" width="60" height="15" fill="#D00"/><rect y="30" width="60" height="15" fill="#FFCE00"/></svg>',
    "fr": '<svg viewBox="0 0 60 45" width="21" height="16" aria-hidden="true"><rect width="20" height="45" fill="#002395"/><rect x="20" width="20" height="45" fill="#fff"/><rect x="40" width="20" height="45" fill="#ED2939"/></svg>',
    "zh": '<svg viewBox="0 0 60 45" width="21" height="16" aria-hidden="true"><rect width="60" height="45" rx="2" fill="#DE2910"/><polygon fill="#FFDE00" points="12,9 13.8,14.4 19.5,14.4 14.9,17.7 16.6,23.1 12,19.8 7.4,23.1 9.1,17.7 4.5,14.4 10.2,14.4"/></svg>',
    "ru": '<svg viewBox="0 0 60 45" width="21" height="16" aria-hidden="true"><rect width="60" height="15" fill="#fff"/><rect y="15" width="60" height="15" fill="#0039A6"/><rect y="30" width="60" height="15" fill="#D52B1E"/></svg>',
}

HREFLANG = """<link rel="alternate" hreflang="x-default" href="https://pishtaj.ir/" />
<link rel="alternate" hreflang="fa-IR" href="https://pishtaj.ir/" />
<link rel="alternate" hreflang="en" href="https://pishtaj.ir/en/{page}" />
<link rel="alternate" hreflang="ar" href="https://pishtaj.ir/ar/{page}" />
<link rel="alternate" hreflang="tr" href="https://pishtaj.ir/tr/{page}" />
<link rel="alternate" hreflang="de" href="https://pishtaj.ir/de/{page}" />
<link rel="alternate" hreflang="fr" href="https://pishtaj.ir/fr/{page}" />
<link rel="alternate" hreflang="zh-CN" href="https://pishtaj.ir/zh/{page}" />
<link rel="alternate" hreflang="ru" href="https://pishtaj.ir/ru/{page}" />"""

HEAD_ICONS = """<link rel="icon" type="image/png" sizes="32x32" href="../assets/images/favicon/favicon-32.png"><link rel="apple-touch-icon" sizes="180x180" href="../assets/images/favicon/apple-touch-icon.png"><link rel="shortcut icon" href="../favicon.ico">
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />"""

MENU_JS = """<script>(function(){var b=document.getElementById('menuToggle'),n=document.getElementById('mainNav');if(b&&n)b.onclick=function(){var o=n.classList.toggle('open');b.setAttribute('aria-expanded',o?'true':'false');};})();</script>
<script src="../assets/js/ptf-discover.js?v=34.39.16" defer></script>
<script src="../assets/js/ptf-analytics.js" defer></script>"""

LANGS_FOOT = """<a href="../">فارسی</a>
<a href="../en/">English</a>
<a href="../ar/">العربية</a>
<a href="../tr/">Türkçe</a>
<a href="../de/">Deutsch</a>
<a href="../fr/">Français</a>
<a href="../zh/">中文</a>
<a href="../ru/">Русский</a>"""

L = {
"tr": dict(
    html_lang="tr", og="tr_TR", hreflang="tr",
    brand="Pishro Tajhiz Fartak", brand_s="Endüstriyel ekipman tedarikçisi",
    nav_home="Ana sayfa", nav_svc="Hizmetler", nav_about="Hakkımızda", nav_proj="Projeler", nav_rfq="Teklif", nav_contact="İletişim",
    skip="İçeriğe geç", menu="Menüyü aç", langs="Diller",
    title="Endüstriyel ekipman tedarikçisi — petrol, gaz ve petrokimya | PTF",
    desc="Pishro Tajhiz Fartak, İran ve Ortadoğu’daki petrol, gaz, petrokimya, çelik ve enerji projeleri için borulama, vana, enstrümantasyon ve elektrik ekipmanı tedarik eder.",
    kicker="Proje tedariki, ithalat ve endüstriyel kaynak",
    h1a="Kritik ekipmanı ", h1b="güvenilir, hızlı ve spesifikasyona uygun", h1c=" tedarik edin",
    hero="Pishro Tajhiz Fartak; petrol, gaz, petrokimya, çelik, çimento ve enerji projeleri için borulama, endüstriyel elektrik ve enstrümantasyon paketlerinde uzmanlaşmış bir tedarikçidir — teknik RFQ incelemesinden belgelenmiş teslimata.",
    cta_rfq="Teknik RFQ gönderin", cta_sales="Satışla görüşün",
    chip=["A106 boru","WN flanş","Rosemount 3051","API 6D küresel vana","VFD / MCC"],
    t14="+14", t14s="Yıllık endüstriyel tedarik", trfq="RFQ", trfqs="Kodlu, izlenebilir talepler", tavl="AVL", tavls="Vendor listesine göre kaynak", tiso="ISO 9001", tisos="+ ISO 10002 / 10004",
    role_l="Role göre başlayın", role_h="Doğru işleme daha hızlı ulaşın", role_p="Alıcı, proje mühendisi, takip ekibi ve tedarikçi için ayrı yollar — Farsça sitedekiyle aynı yapı.",
    r1h="Alıcı / EPC’yim", r1p="Eklerle gerçek bir RFQ ve sunucu kaynaklı takip kodu gönderin.",
    r2h="Proje mühendisiyim", r2p="Hassas bir talep paketi için standartlar, datasheet’ler ve kategori sayfaları.",
    r3h="RFQ takip ediyorum", r3p="Takip kodunuzla inceleme, tedarik, teklif ve teslimat durumunu görün.",
    r4h="Tedarikçiyim", r4p="PTF proje tedarik ağına katılmak için marka ve yetenek kaydı.",
    why_l="Neden PTF", why_h="EPC yüklenicilerinin kullandığı dört taahhüt",
    w1h="Vendor listesi uyumu", w1p="Siparişten önce datasheet ve AVL incelemesi; sapmalar RFQ ve TBE’de kaydedilir.",
    w2h="Çevik kaynak", w2p="Parça numarası, belgeler ve teslim süresi üzerinden yurt içi ve yurt dışı kaynaklar.",
    w3h="İzlenen talepler", w3p="Satın alma durumunun telefonda kaybolmaması için sunucu kodları.",
    w4h="Orijinallik ve TPI", w4p="Ekipman türüne göre MTC, COC, test, kalibrasyon, FAT veya TPI.",
    board="Yönetim kurulu", chair="Hamed Lavasani Manesh", chair_r="Yönetim Kurulu Başkanı",
    chair_p="15 yılı aşkın endüstriyel proje yönetimi ve petrol-gaz ekipman tedariki deneyimi ve PMP belgesiyle PTF’nin kalite ve büyüme gündemini belirler.",
    about_l="PTF hakkında", about_h="Duramayacak tesisler için çevik bir tedarik zinciri",
    about_p="Tedarikçi seçmek yalnızca mal almak değildir. Teknik uyum, program, belgeler, marka orijinalliği ve cevap veren bir ekiptir.",
    li=["RFQ, MTO, datasheet ve proje standardı analizi","Kanıtlanmış markalardan borulama, elektrik ve enstrümantasyon","Teslim süresi ve şartlarla şeffaf teknik-ticari teklifler","Petrol, gaz, petrokimya, çelik, çimento ve enerji desteği"],
    svc_l="Tedarik alanları", svc_h="Proje-kritik kalemler için altı uzman yol",
    svc_p="Farsça ana sayfadakiyle aynı hizmet haritası.",
    s1="Borulama ve flanşlar", s1p="Dikişsiz A106 / A333 / API 5L, ASME B16.5 flanşlar, fitting, conta ve civata — değirmen sertifikalarıyla.",
    s2="Endüstriyel vanalar", s2p="API 600 sürgülü, API 6D küresel, çek valf, kelebek, kontrol vanaları, PSV ve aktüatörler.",
    s3="Elektrik", s3p="AG/OG panolar, ACB/MCCB, transformatör, VFD, UPS, PLC ve MCC paketleri.",
    s4="Enstrümantasyon", s4p="Rosemount 3051, debi, seviye, sıcaklık, gaz algılama ve kontrol vanaları.",
    s5="Pompalar", s5p="API 610, ANSI proses, dozaj ve kademeli pompalar, mekanik salmastra ve yedekler.",
    s6="Kazan ve buhar", s6p="Ateş ve su borulu kazanlar, brülörler, buhar kapanları, eşanjörler ve basınçlı kaplar.",
    all_svc="Tüm hizmetler →", brands_l="Kaynakladığımız markalar", brands_h="Enerji projelerinde kullanılan üreticilere erişim",
    ev_l="Yayımlanabilir kanıt", ev_h="Tedarik sicilini nasıl paylaşıyoruz", ev_p="Kapsam, standartlar, KA ve teslimat — müşteri adları olmadan.",
    ev1="Borulama ve vanalar", ev1p="Rafineri ve petrokimya proses hatları — ASME, API, NACE, MTC 3.1.",
    ev2="Elektrik ve enstrümantasyon", ev2p="Transmiter, debi ölçer, dağıtım panoları ve otomasyon.",
    cases="Vaka çalışmaları →", faq_l="SSS", faq_h="Alıcıların ilk sorduğu sorular",
    q1="Hangi ekipman kategorilerini tedarik edersiniz?", a1="Borulama, flanş, fitting, endüstriyel vana, enstrümantasyon, elektrik, pompa ve kompresör — proje vendor listesine ve tam KA belgelerine göre.",
    q2="Teklif nasıl isterim?", a2="Datasheet, miktar, teslim şartları ve onaylı vendor listesini gönderin. Her satırı inceler, belgelenmiş fiyatlı teklif döneriz.",
    q3="Değirmen sertifikası ve muayene sağlıyor musunuz?", a3="Evet. MTC 3.1/3.2, TPI (Bureau Veritas, SGS, DNV), NDT ve PMI sözleşmeye göre ayarlanır.",
    q4="Projeye özel vendor listesine uyabilir misiniz?", a4="Vendor listesi uyumu temel yetkinliğimizdir. NIOC, NIGC, NPC ve büyük EPC listelerindeki markalarla çalışırız.",
    send="Teknik RFQ gönderin", addr="16. kat, A Blok, Tooba Kompleksi, Koohak Bulvarı, Tahran",
    desk="Satış masası", open="RFQ masasını aç", explore="Keşfet", languages="Diller", contact="İletişim",
    foot="Petrol ve proses tesisi projeleri için uzman borulama, elektrik ve enstrümantasyon tedariki.",
    rights="© 2026 Pishro Tajhiz Fartak. Tüm hakları saklıdır.",
    about_title="Hakkımızda — Endüstriyel ekipman tedarikçisi | PTF",
    about_h1="Pishro Tajhiz Fartak hakkında", about_sub="2014’ten beri mühendislik odaklı endüstriyel tedarik — Tahran merkezli, Ortadoğu odaklı.",
    who="Kimiz", who_p="PTF, Tahran’da uzman bir endüstriyel ekipman tedarikçisidir (sicil 578831, 2014). Petrol ve gaz, petrokimya, çelik, çimento ve enerjiye borulama, vana, enstrümantasyon ve elektrik ekipmanı sağlarız.",
    how="Nasıl çalışırız", how_p="Her RFQ, fiyatlandırmadan önce müşteri vendor listesi, datasheet ve ASME / API / ASTM / ISO / IEC gereklerine denk düşürülür.",
    svc_title="Endüstriyel ekipman tedarik hizmetleri | PTF",
    svc_h1="Tedarik hizmetleri", svc_sub="Farsça sitedeki aynı altı alan — yedek parçadan konsolide proje paketine.",
    how_eng="İş birliği RFQ paketiyle başlar. Mühendisler satır satır doğrular, onaylı üreticilerden kaynaklar, hızlandırır, muayene eder ve teslim eder.",
    proj_title="Projeler ve vaka çalışmaları | PTF",
    proj_h1="Projeler ve vakalar", proj_sub="Yayımlanabilir kanıt: kapsam, standartlar, KA ve sonuç — müşteri kimliği gizli.",
    c1t="Petrol ve gaz rafinerisi", c1h="Class 1500 yüksek basınç borulama", c1p="A106 Gr.B dikişsiz boru ve WN flanş ASME B16.5, NACE MR0175, MTC 3.1 ile teslim.",
    c2t="Petrokimya", c2h="DP transmiter ve debi ölçer", c2p="Planlı turnaround için Rosemount 3051 ve KROHNE — ATEX, kalibrasyon, SIL 2.",
    c3t="Çelik", c3h="AG pano ve MCC", c3p="Haddehane genişlemesi için Siemens 3WL ACB, MCCB ve ABB PLC, FAT sertifikası.",
    c4t="Gaz toplama", c4h="API 6D trunnion küresel vanalar", c4p="Pnömatik aktüatörlü Class 600–1500, PMI ve değirmen sertifikaları.",
    c5t="Ekşi servis", c5h="NACE conta paketi", c5p="H₂S servisi için 316 SS çekirdekli spiral-wound ve kammprofile, ASME B16.20 / NACE MR0175.",
),
"de": dict(
    html_lang="de", og="de_DE", hreflang="de",
    brand="Pishro Tajhiz Fartak", brand_s="Lieferant industrieller Ausrüstung",
    nav_home="Start", nav_svc="Leistungen", nav_about="Über uns", nav_proj="Projekte", nav_rfq="Anfrage", nav_contact="Kontakt",
    skip="Zum Inhalt", menu="Menü öffnen", langs="Sprachen",
    title="Lieferant industrieller Ausrüstung — Öl, Gas und Petrochemie | PTF",
    desc="Pishro Tajhiz Fartak liefert Rohrleitung, Armaturen, Messtechnik und Elektroausrüstung für Öl-, Gas-, Petrochemie-, Stahl- und Energieprojekte im Iran und Nahen Osten.",
    kicker="Projektlieferung, Import und industrielle Beschaffung",
    h1a="Kritische Ausrüstung ", h1b="zuverlässig, schnell und spezifikationsgerecht", h1c=" liefern",
    hero="Pishro Tajhiz Fartak ist spezialisierter Lieferant für Rohrleitungs-, Elektro- und Messtechnikpakete für Öl, Gas, Petrochemie, Stahl, Zement und Energie — von der technischen RFQ-Prüfung bis zur dokumentierten Lieferung.",
    cta_rfq="Technische RFQ senden", cta_sales="Vertrieb kontaktieren",
    chip=["A106-Rohr","WN-Flansche","Rosemount 3051","API-6D-Kugelhahn","VFD / MCC"],
    t14="+14", t14s="Jahre industrielle Lieferung", trfq="RFQ", trfqs="Codierte, nachverfolgbare Anfragen", tavl="AVL", tavls="Beschaffung nach Vendor List", tiso="ISO 9001", tisos="+ ISO 10002 / 10004",
    role_l="Nach Rolle starten", role_h="Schneller zur richtigen Aktion", role_p="Einkäufer, Projektingenieure, Nachverfolgung und Lieferanten haben eigene Wege — wie auf der persischen Seite.",
    r1h="Ich bin Einkäufer / EPC", r1p="Echte RFQ mit Anhängen und servergeneriertem Tracking-Code.",
    r2h="Ich bin Projektingenieur", r2p="Normen, Datenblätter und Kategorieseiten für ein präzises Anfragepaket.",
    r3h="Ich verfolge eine RFQ", r3p="Status von Prüfung, Beschaffung, Angebot und Lieferung mit Ihrem Code.",
    r4h="Ich bin Lieferant", r4p="Marken und Fähigkeiten registrieren und ins PTF-Netzwerk eintreten.",
    why_l="Warum PTF", why_h="Vier Zusagen, die EPC-Auftragnehmer nutzen",
    w1h="Vendor-List-Konformität", w1p="Datenblatt- und AVL-Prüfung vor Bestellung; Abweichungen in RFQ und TBE.",
    w2h="Agile Beschaffung", w2p="In- und ausländische Quellen gegen Teilenummer, Dokumente und Lieferzeit.",
    w3h="Nachverfolgte Anfragen", w3p="Servercodes, damit der Einkauf den Status nicht telefonisch jagen muss.",
    w4h="Authentizität & TPI", w4p="MTC, COC, Prüfberichte, Kalibrierung, FAT oder TPI je Gerätetyp.",
    board="Vorstand", chair="Hamed Lavasani Manesh", chair_r="Vorstandsvorsitzender",
    chair_p="Mit über 15 Jahren in industriellem Projektmanagement und Öl-und-Gas-Ausrüstungslieferung sowie PMP-Zertifikat setzt er die Qualitäts- und Wachstumsagenda von PTF.",
    about_l="Über PTF", about_h="Eine agile Lieferkette für Anlagen, die nicht stillstehen dürfen",
    about_p="Einen Lieferanten zu wählen heißt nicht nur Ware kaufen. Es geht um technische Passung, Termin, Dokumente, Markenechtheit und ein Team, das antwortet.",
    li=["Analyse von RFQ, MTO, Datenblatt und Projektnorm","Rohrleitung, Elektro und Messtechnik von bewährten Marken","Klare technisch-kommerzielle Angebote mit Lieferzeit","Unterstützung für Öl, Gas, Petrochemie, Stahl, Zement und Energie"],
    svc_l="Lieferbereiche", svc_h="Sechs spezialisierte Pfade für projektkritische Positionen",
    svc_p="Dieselbe Leistungskarte wie auf der persischen Startseite.",
    s1="Rohrleitung & Flansche", s1p="Nahtlos A106 / A333 / API 5L, ASME-B16.5-Flansche, Fittinge, Dichtungen und Verschraubung mit Werkszeugnissen.",
    s2="Industriearmaturen", s2p="Schieber API 600, Kugelhahn API 6D, Rückschlag, Absperrklappe, Regelventile, PSV und Antriebe.",
    s3="Elektro", s3p="NS/MS-Schaltanlagen, ACB/MCCB, Transformatoren, VFD, USV, SPS und MCC-Pakete.",
    s4="Messtechnik", s4p="Rosemount 3051, Durchfluss, Füllstand, Temperatur, Gaswarnung und Regelventile.",
    s5="Pumpen", s5p="API 610, ANSI-Prozess, Dosier- und mehrstufige Pumpen plus Gleitringdichtungen.",
    s6="Kessel & Dampf", s6p="Flamm- und Wasserrohrkessel, Brenner, Kondensatableiter, Wärmetauscher und Druckbehälter.",
    all_svc="Alle Leistungen →", brands_l="Marken, die wir beschaffen", brands_h="Zugang zu Herstellern auf Energieprojekten",
    ev_l="Veröffentlichbare Nachweise", ev_h="Wie wir Lieferhistorie teilen", ev_p="Umfang, Normen, QS und Lieferung — ohne Kundennamen.",
    ev1="Rohrleitung & Armaturen", ev1p="Prozessleitungen für Raffinerien und Petrochemie nach ASME, API und NACE — mit MTC 3.1.",
    ev2="Elektro & Messtechnik", ev2p="Transmitter, Durchflussmesser, Verteilerschränke und Automatisierung.",
    cases="Fallstudien →", faq_l="FAQ", faq_h="Fragen, die Einkäufer zuerst stellen",
    q1="Welche Ausrüstungskategorien liefern Sie?", a1="Rohrleitung, Flansche, Fittinge, Industriearmaturen, Messtechnik, Elektro, Pumpen und Verdichter — gegen Vendor List mit voller QS-Dokumentation.",
    q2="Wie fordere ich ein Angebot an?", a2="Senden Sie Datenblätter, Mengen, Lieferbedingungen und die freigegebene Vendor List. Wir prüfen jede Zeile und geben ein bepreistes Angebot mit Dokumentenzusagen zurück.",
    q3="Liefern Sie Werkszeugnisse und Inspektion?", a3="Ja. MTC 3.1/3.2, TPI (Bureau Veritas, SGS, DNV), ZfP und PMI nach Vertrag.",
    q4="Können Sie eine projektspezifische Vendor List einhalten?", a4="Vendor-List-Konformität ist Kernkompetenz. Wir kennen die Marken auf NIOC-, NIGC-, NPC- und großen EPC-Listen.",
    send="Technische RFQ senden", addr="16. Stock, Block A, Tooba-Komplex, Koohak Blvd., Teheran",
    desk="Vertriebstisch", open="RFQ-Schalter öffnen", explore="Entdecken", languages="Sprachen", contact="Kontakt",
    foot="Spezialisierte Rohrleitungs-, Elektro- und Messtechniklieferung für Energie- und Prozessanlagenprojekte.",
    rights="© 2026 Pishro Tajhiz Fartak. Alle Rechte vorbehalten.",
    about_title="Über uns — Lieferant industrieller Ausrüstung | PTF",
    about_h1="Über Pishro Tajhiz Fartak", about_sub="Seit 2014 engineeringgeführte industrielle Lieferung — Sitz Teheran, Fokus Naher Osten.",
    who="Wer wir sind", who_p="PTF ist ein spezialisierter Lieferant in Teheran (Reg. 578831, 2014). Wir bedienen Öl und Gas, Petrochemie, Stahl, Zement und Energie mit Rohrleitung, Armaturen, Messtechnik und Elektroausrüstung.",
    how="Wie wir arbeiten", how_p="Jede RFQ wird vor der Preisbildung mit Vendor List, Datenblättern und ASME/API/ASTM/ISO/IEC abgeglichen.",
    svc_title="Lieferleistungen für Industrieausrüstung | PTF",
    svc_h1="Lieferleistungen", svc_sub="Dieselben sechs Bereiche wie die persische Seite — vom Ersatzteil bis zum konsolidierten Projektpaket.",
    how_eng="Die Zusammenarbeit beginnt mit Ihrem RFQ-Paket. Ingenieure prüfen zeilenweise, beschaffen bei freigegebenen Herstellern, beschleunigen, inspizieren und liefern.",
    proj_title="Projekte und Fallstudien | PTF",
    proj_h1="Projekte und Fälle", proj_sub="Veröffentlichbare Nachweise: Umfang, Normen, QS und Ergebnis — Kundenidentität vertraulich.",
    c1t="Öl- und Gasraffinerie", c1h="Hochdruck-Rohrleitung Class 1500", c1p="Nahtlosrohr A106 Gr.B und WN-Flansche ASME B16.5, NACE MR0175, geliefert mit MTC 3.1.",
    c2t="Petrochemie", c2h="DP-Transmitter und Durchflussmesser", c2p="Rosemount 3051 und KROHNE für ein geplantes Turnaround — ATEX, Kalibrierung, SIL 2.",
    c3t="Stahl", c3h="NS-Schaltanlage und MCC", c3p="Siemens-3WL-ACB, MCCB und ABB-SPS für eine Walzwerkserweiterung, mit FAT-Zertifikat.",
    c4t="Gassammlung", c4h="API-6D-Trunnion-Kugelhähne", c4p="Class 600–1500 mit Pneumatikantrieben, PMI und Werkszeugnissen.",
    c5t="Saurer Dienst", c5h="NACE-Dichtungspaket", c5p="Spiral-wound und Kammprofile mit 316-SS-Kern für H₂S, ASME B16.20 / NACE MR0175.",
),
"fr": dict(
    html_lang="fr", og="fr_FR", hreflang="fr",
    brand="Pishro Tajhiz Fartak", brand_s="Fournisseur d’équipements industriels",
    nav_home="Accueil", nav_svc="Services", nav_about="À propos", nav_proj="Projets", nav_rfq="Demande", nav_contact="Contact",
    skip="Aller au contenu", menu="Ouvrir le menu", langs="Langues",
    title="Fournisseur d’équipements industriels — pétrole, gaz et pétrochimie | PTF",
    desc="Pishro Tajhiz Fartak fournit tuyauterie, vannes, instrumentation et équipements électriques pour les projets pétrole, gaz, pétrochimie, acier et énergie en Iran et au Moyen-Orient.",
    kicker="Fourniture de projet, import et sourcing industriel",
    h1a="Fournir les équipements critiques ", h1b="avec fiabilité, rapidité et conformité", h1c="",
    hero="Pishro Tajhiz Fartak est un fournisseur spécialisé de packages tuyauterie, électrique et instrumentation pour le pétrole, le gaz, la pétrochimie, l’acier, le ciment et l’énergie — de l’examen technique du RFQ à la livraison documentée.",
    cta_rfq="Envoyer un RFQ technique", cta_sales="Parler aux ventes",
    chip=["Tube A106","Brides WN","Rosemount 3051","Vanne à boisseau API 6D","VFD / MCC"],
    t14="+14", t14s="Années de fourniture industrielle", trfq="RFQ", trfqs="Demandes codées et traçables", tavl="AVL", tavls="Sourcing selon vendor list", tiso="ISO 9001", tisos="+ ISO 10002 / 10004",
    role_l="Commencer selon le rôle", role_h="Atteindre plus vite la bonne action", role_p="Acheteurs, ingénieurs projet, suivi et fournisseurs ont chacun un parcours — comme sur le site persan.",
    r1h="Je suis acheteur / EPC", r1p="Envoyez un vrai RFQ avec pièces jointes et code de suivi généré par le serveur.",
    r2h="Je suis ingénieur projet", r2p="Normes, datasheets et pages de catégories pour un dossier d’enquête précis.",
    r3h="Je suis un RFQ", r3p="Consultez l’examen, le sourcing, l’offre et la livraison avec votre code.",
    r4h="Je suis fournisseur", r4p="Enregistrez marques et capacités pour rejoindre le réseau PTF.",
    why_l="Pourquoi PTF", why_h="Quatre engagements utilisés par les EPC",
    w1h="Conformité vendor list", w1p="Revue datasheet et AVL avant commande ; les écarts sont consignés dans le RFQ et le TBE.",
    w2h="Sourcing agile", w2p="Sources nationales et étrangères vérifiées selon n° de pièce, documents et délai.",
    w3h="Demandes suivies", w3p="Codes serveur pour que les achats ne poursuivent pas le statut au téléphone.",
    w4h="Authenticité et TPI", w4p="MTC, COC, rapports d’essai, étalonnage, FAT ou TPI selon le type d’équipement.",
    board="Conseil d’administration", chair="Hamed Lavasani Manesh", chair_r="Président du conseil",
    chair_p="Plus de 15 ans en gestion de projets industriels et fourniture d’équipements pétrole et gaz, certifié PMP, il fixe l’agenda qualité et croissance de PTF.",
    about_l="À propos de PTF", about_h="Une chaîne d’approvisionnement agile pour les usines qui ne peuvent s’arrêter",
    about_p="Choisir un fournisseur n’est pas seulement acheter. C’est l’adéquation technique, le planning, les documents, l’authenticité de marque et une équipe qui répond.",
    li=["Analyse RFQ, MTO, datasheet et normes projet","Tuyauterie, électrique et instrumentation de marques éprouvées","Offres technico-commerciales claires avec délai","Soutien pétrole, gaz, pétrochimie, acier, ciment et énergie"],
    svc_l="Domaines de fourniture", svc_h="Six parcours spécialisés pour les postes critiques",
    svc_p="La même carte de services que la page d’accueil persane.",
    s1="Tuyauterie et brides", s1p="Sans soudure A106 / A333 / API 5L, brides ASME B16.5, raccords, joints et boulonnerie avec certificats usine.",
    s2="Vannes industrielles", s2p="Vanne à opercule API 600, boisseau API 6D, clapet, papillon, vannes de régulation, PSV et actionneurs.",
    s3="Électrique", s3p="Tableaux BT/MT, ACB/MCCB, transformateurs, VFD, UPS, API et packages MCC.",
    s4="Instrumentation", s4p="Rosemount 3051, débit, niveau, température, détection gaz et vannes de régulation.",
    s5="Pompes", s5p="API 610, process ANSI, dosage et multi-étages, plus garnitures mécaniques.",
    s6="Chaudières et vapeur", s6p="Chaudières tubes de fumée et d’eau, brûleurs, purgeurs, échangeurs et appareils à pression.",
    all_svc="Tous les services →", brands_l="Marques sourcées", brands_h="Accès aux fabricants des projets énergie",
    ev_l="Preuves publiables", ev_h="Comment nous partageons le historique", ev_p="Périmètre, normes, AQ et livraison — sans noms de clients.",
    ev1="Tuyauterie et vannes", ev1p="Lignes process raffineries et pétrochimie selon ASME, API et NACE — avec MTC 3.1.",
    ev2="Électrique et instrumentation", ev2p="Transmetteurs, débitmètres, tableaux de distribution et automatisme.",
    cases="Études de cas →", faq_l="FAQ", faq_h="Questions que les acheteurs posent d’abord",
    q1="Quelles catégories d’équipements fournissez-vous ?", a1="Tuyauterie, brides, raccords, vannes, instrumentation, électrique, pompes et compresseurs — contre vendor list avec documentation AQ complète.",
    q2="Comment demander un devis ?", a2="Envoyez datasheets, quantités, Incoterms et vendor list approuvée. Nous examinons chaque ligne et renvoyons une offre chiffrée avec engagements documentaires.",
    q3="Fournissez-vous certificats usine et inspection ?", a3="Oui. MTC 3.1/3.2, TPI (Bureau Veritas, SGS, DNV), CND et PMI selon contrat.",
    q4="Pouvez-vous respecter une vendor list spécifique ?", a4="La conformité vendor list est une compétence centrale. Nous travaillons les marques des listes NIOC, NIGC, NPC et grands EPC.",
    send="Envoyer un RFQ technique", addr="16e étage, bloc A, complexe Tooba, bd Koohak, Téhéran",
    desk="Bureau des ventes", open="Ouvrir le bureau RFQ", explore="Explorer", languages="Langues", contact="Contact",
    foot="Fourniture spécialisée tuyauterie, électrique et instrumentation pour les projets énergie et process.",
    rights="© 2026 Pishro Tajhiz Fartak. Tous droits réservés.",
    about_title="À propos — Fournisseur d’équipements industriels | PTF",
    about_h1="À propos de Pishro Tajhiz Fartak", about_sub="Fourniture industrielle menée par l’ingénierie depuis 2014 — basé à Téhéran, tourné vers le Moyen-Orient.",
    who="Qui nous sommes", who_p="PTF est un fournisseur spécialisé à Téhéran (reg. 578831, 2014). Nous servons pétrole et gaz, pétrochimie, acier, ciment et énergie.",
    how="Comment nous travaillons", how_p="Chaque RFQ est rapproché de la vendor list, des datasheets et des exigences ASME / API / ASTM / ISO / IEC avant chiffrage.",
    svc_title="Services de fourniture d’équipements industriels | PTF",
    svc_h1="Services de fourniture", svc_sub="Les six mêmes domaines que le site persan — de la pièce de rechange au package projet consolidé.",
    how_eng="La collaboration commence par votre dossier RFQ. Les ingénieurs vérifient ligne à ligne, sourcent auprès de fabricants agréés, accélèrent, inspectent et livrent.",
    proj_title="Projets et études de cas | PTF",
    proj_h1="Projets et cas", proj_sub="Preuves publiables : périmètre, normes, AQ et résultat — identité client confidentielle.",
    c1t="Raffinerie pétrole et gaz", c1h="Tuyauterie haute pression Class 1500", c1p="Tube sans soudure A106 Gr.B et brides WN ASME B16.5, NACE MR0175, livré avec MTC 3.1.",
    c2t="Pétrochimie", c2h="Transmetteurs DP et débitmètres", c2p="Rosemount 3051 et KROHNE pour un arrêt programmé — ATEX, étalonnage, SIL 2.",
    c3t="Acier", c3h="Tableau BT et MCC", c3p="ACB Siemens 3WL, MCCB et API ABB pour une extension de laminoir, avec certificat FAT.",
    c4t="Collecte de gaz", c4h="Vannes à boisseau API 6D trunnion", c4p="Class 600–1500 avec actionneurs pneumatiques, PMI et certificats usine.",
    c5t="Service acide", c5h="Package joints NACE", c5p="Spiral-wound et kammprofile âme 316 SS pour H₂S, ASME B16.20 / NACE MR0175.",
),
"zh": dict(
    html_lang="zh-CN", og="zh_CN", hreflang="zh-CN",
    brand="Pishro Tajhiz Fartak", brand_s="工业设备供应商",
    nav_home="首页", nav_svc="服务", nav_about="关于我们", nav_proj="项目", nav_rfq="询价", nav_contact="联系",
    skip="跳到内容", menu="打开菜单", langs="语言",
    title="工业设备供应商 — 石油、天然气与石化 | PTF",
    desc="Pishro Tajhiz Fartak 为伊朗及中东的石油、天然气、石化、钢铁与电力项目供应管道、阀门、仪表与电气设备，符合厂商名单、材质证书与第三方检验。",
    kicker="项目供货、进口与工业寻源",
    h1a="以", h1b="可靠、快速、符合规格", h1c="的方式供应关键设备",
    hero="Pishro Tajhiz Fartak 专注于石油、天然气、石化、钢铁、水泥与电力项目的管道、工业电气与仪表成套供应——从技术询价审核到带文件的交付。",
    cta_rfq="提交技术询价", cta_sales="联系销售",
    chip=["A106 钢管","WN 法兰","Rosemount 3051","API 6D 球阀","变频器 / MCC"],
    t14="+14", t14s="年工业供货", trfq="RFQ", trfqs="可编码追踪的询价", tavl="AVL", tavls="按厂商名单寻源", tiso="ISO 9001", tisos="+ ISO 10002 / 10004",
    role_l="按角色开始", role_h="更快到达正确操作", role_p="采购、项目工程师、跟单与供应商各有路径——与波斯语站点相同。",
    r1h="我是采购 / EPC", r1p="提交真实询价、附件及服务器签发的追踪码。",
    r2h="我是项目工程师", r2p="标准、数据表与品类页，用于编制精确询价包。",
    r3h="我在跟踪询价", r3p="用追踪码查看审核、寻源、报价与交付状态。",
    r4h="我是供应商", r4p="登记品牌与能力，加入 PTF 项目供应网络。",
    why_l="为何选择 PTF", why_h="EPC 承包商实际使用的四项承诺",
    w1h="厂商名单符合性", w1p="下单前审核数据表与 AVL；偏差记入询价与技术比选。",
    w2h="敏捷寻源", w2p="按件号、文件与交期核验国内外货源。",
    w3h="可追踪询价", w3p="服务器生成追踪码，采购无需反复电话催进度。",
    w4h="真伪与第三方检验", w4p="按设备类型安排 MTC、COC、试验、校准、FAT 或 TPI。",
    board="董事会", chair="Hamed Lavasani Manesh", chair_r="董事长",
    chair_p="拥有逾十五年工业项目管理与油气设备供应经验，并持有 PMP，负责 PTF 的质量与增长方向。",
    about_l="关于 PTF", about_h="面向不可停产装置的敏捷供应链",
    about_p="选择供应商不只是买货，而是技术符合、进度、文件、品牌真伪以及能响应的团队。",
    li=["RFQ、MTO、数据表与项目标准分析","从可靠品牌寻源管道、电气与仪表","带交期与条款的清晰技术商务报价","覆盖石油、天然气、石化、钢铁、水泥与电力"],
    svc_l="供货领域", svc_h="面向项目关键物料的六条专业路径",
    svc_p="与波斯语首页相同的服务地图。",
    s1="管道与法兰", s1p="无缝 A106 / A333 / API 5L、ASME B16.5 法兰、管件、垫片与螺栓，附材质证书。",
    s2="工业阀门", s2p="API 600 闸阀、API 6D 球阀、止回、蝶阀、调节阀、安全阀与执行机构。",
    s3="电气", s3p="低压/中压开关柜、ACB/MCCB、变压器、变频器、UPS、PLC 与 MCC 成套。",
    s4="仪表", s4p="Rosemount 3051、流量、物位、温度、气体探测与调节阀。",
    s5="泵", s5p="API 610、ANSI 流程泵、计量泵与多级泵，以及机械密封与备件。",
    s6="锅炉与蒸汽", s6p="火管/水管锅炉、燃烧器、疏水阀、换热器与压力容器。",
    all_svc="全部服务 →", brands_l="我们寻源的品牌", brands_h="覆盖能源项目常用制造商",
    ev_l="可公开证据", ev_h="我们如何分享供货业绩", ev_p="范围、标准、质量与交付——不披露客户名称。",
    ev1="管道与阀门", ev1p="炼厂与石化工艺管线，符合 ASME、API、NACE，附 MTC 3.1。",
    ev2="电气与仪表", ev2p="变送器、流量计、配电柜与自动化。",
    cases="案例研究 →", faq_l="常见问题", faq_h="采购首先会问的问题",
    q1="你们供应哪些设备类别？", a1="管道、法兰、管件、工业阀门、仪表、电气、泵与压缩机——对照项目厂商名单并提供完整质量文件。",
    q2="如何询价？", a2="请发送数据表、数量、交货条件与批准厂商名单。我们逐行审核后返回带文件承诺的报价。",
    q3="是否提供材质证书与检验？", a3="是。可按合同安排 MTC 3.1/3.2、第三方检验（Bureau Veritas、SGS、DNV）、无损检测与 PMI。",
    q4="能否符合项目专用厂商名单？", a4="厂商名单符合性是核心能力。我们熟悉 NIOC、NIGC、NPC 及大型 EPC 名单中的品牌。",
    send="提交技术询价", addr="伊朗德黑兰 Koohak 大道 Tooba 综合体 A 座 16 层",
    desk="销售台", open="打开询价台", explore="浏览", languages="语言", contact="联系",
    foot="为能源与流程装置项目提供专业的管道、电气与仪表供货。",
    rights="© 2026 Pishro Tajhiz Fartak。保留所有权利。",
    about_title="关于我们 — 工业设备供应商 | PTF",
    about_h1="关于 Pishro Tajhiz Fartak", about_sub="自 2014 年起以工程为导向的工业供货——总部德黑兰，面向中东。",
    who="我们是谁", who_p="PTF 是总部位于德黑兰的专业工业设备供应商（注册号 578831，2014）。为石油天然气、石化、钢铁、水泥与电力供应管道、阀门、仪表与电气设备。",
    how="我们如何工作", how_p="每份询价在报价前都对照客户厂商名单、数据表及 ASME / API / ASTM / ISO / IEC 要求。",
    svc_title="工业设备供应服务 | PTF",
    svc_h1="供应服务", svc_sub="与波斯语站点相同的六个领域——从备件到合并的项目包。",
    how_eng="合作从您的询价包开始。工程师逐行核实，向批准制造商寻源，催交、检验并交付。",
    proj_title="项目与案例 | PTF",
    proj_h1="项目与案例", proj_sub="可公开证据：范围、标准、质量与结果——客户身份保密。",
    c1t="油气炼厂", c1h="Class 1500 高压管道", c1p="A106 Gr.B 无缝管与 WN 法兰 ASME B16.5，NACE MR0175，附 MTC 3.1 交付。",
    c2t="石化", c2h="差压变送器与流量计", c2p="计划大修用 Rosemount 3051 与 KROHNE——ATEX、校准、SIL 2。",
    c3t="钢铁", c3h="低压开关柜与 MCC", c3p="轧机扩建用 Siemens 3WL ACB、MCCB 与 ABB PLC，附 FAT 证书。",
    c4t="集气", c4h="API 6D 固定球球阀", c4p="Class 600–1500 配气动执行机构，PMI 与材质证书。",
    c5t="含硫工况", c5h="NACE 垫片包", c5p="H₂S 工况用 316 不锈钢芯缠绕垫与齿形垫，ASME B16.20 / NACE MR0175。",
),
"ru": dict(
    html_lang="ru", og="ru_RU", hreflang="ru",
    brand="Pishro Tajhiz Fartak", brand_s="Поставщик промышленного оборудования",
    nav_home="Главная", nav_svc="Услуги", nav_about="О компании", nav_proj="Проекты", nav_rfq="Запрос", nav_contact="Контакты",
    skip="К содержанию", menu="Открыть меню", langs="Языки",
    title="Поставщик промышленного оборудования — нефть, газ и нефтехимия | PTF",
    desc="Pishro Tajhiz Fartak поставляет трубопроводы, арматуру, КИП и электрооборудование для нефтегазовых, нефтехимических, стальных и энергетических проектов в Иране и на Ближнем Востоке.",
    kicker="Проектные поставки, импорт и промышленный сорсинг",
    h1a="Поставляйте критичное оборудование ", h1b="надёжно, быстро и по спецификации", h1c="",
    hero="Pishro Tajhiz Fartak — специализированный поставщик пакетов трубопроводов, электротехники и КИП для нефти, газа, нефтехимии, стали, цемента и энергетики: от технической проверки RFQ до документированной поставки.",
    cta_rfq="Отправить технический RFQ", cta_sales="Связаться с продажами",
    chip=["Труба A106","Фланцы WN","Rosemount 3051","Шаровой кран API 6D","ПЧ / MCC"],
    t14="+14", t14s="Лет промышленных поставок", trfq="RFQ", trfqs="Кодируемые отслеживаемые запросы", tavl="AVL", tavls="Сорсинг по vendor list", tiso="ISO 9001", tisos="+ ISO 10002 / 10004",
    role_l="Начать по роли", role_h="Быстрее к нужному действию", role_p="У закупщика, инженера проекта, сопровождения и поставщика свои маршруты — как на персидском сайте.",
    r1h="Я закупщик / EPC", r1p="Отправьте реальный RFQ с вложениями и серверным кодом отслеживания.",
    r2h="Я инженер проекта", r2p="Стандарты, даташиты и страницы категорий для точного пакета запроса.",
    r3h="Я отслеживаю RFQ", r3p="Смотрите статус проверки, сорсинга, предложения и поставки по коду.",
    r4h="Я поставщик", r4p="Зарегистрируйте бренды и компетенции, чтобы войти в сеть PTF.",
    why_l="Почему PTF", why_h="Четыре обязательства, которыми пользуются EPC",
    w1h="Соответствие vendor list", w1p="Проверка даташита и AVL до заказа; отклонения фиксируются в RFQ и TBE.",
    w2h="Гибкий сорсинг", w2p="Внутренние и внешние источники по партномеру, документам и сроку.",
    w3h="Отслеживаемые запросы", w3p="Серверные коды, чтобы закупки не выясняли статус по телефону.",
    w4h="Подлинность и TPI", w4p="MTC, COC, протоколы испытаний, калибровка, FAT или TPI по типу оборудования.",
    board="Совет директоров", chair="Hamed Lavasani Manesh", chair_r="Председатель совета",
    chair_p="Более 15 лет в управлении промышленными проектами и поставках нефтегазового оборудования, сертификат PMP — задаёт повестку качества и роста PTF.",
    about_l="О PTF", about_h="Гибкая цепочка поставок для установок, которые нельзя останавливать",
    about_p="Выбор поставщика — не просто покупка товара. Это техническое соответствие, график, документы, подлинность бренда и команда, которая отвечает.",
    li=["Анализ RFQ, MTO, даташитов и стандартов проекта","Трубопроводы, электрика и КИП проверенных брендов","Прозрачные технико-коммерческие предложения со сроком","Поддержка нефти, газа, нефтехимии, стали, цемента и энергетики"],
    svc_l="Направления поставок", svc_h="Шесть специализированных путей для критичных позиций",
    svc_p="Та же карта услуг, что на персидской главной.",
    s1="Трубопроводы и фланцы", s1p="Бесшовные A106 / A333 / API 5L, фланцы ASME B16.5, фитинги, прокладки и крепёж с сертификатами завода.",
    s2="Промышленная арматура", s2p="Задвижки API 600, шаровые API 6D, обратные, дисковые, регулирующие клапаны, PSV и приводы.",
    s3="Электрика", s3p="РУ НН/СН, ACB/MCCB, трансформаторы, ПЧ, ИБП, ПЛК и пакеты MCC.",
    s4="КИП", s4p="Rosemount 3051, расход, уровень, температура, газообнаружение и регулирующие клапаны.",
    s5="Насосы", s5p="API 610, ANSI process, дозирующие и многоступенчатые насосы, торцевые уплотнения и ЗИП.",
    s6="Котлы и пар", s6p="Жаротрубные и водотрубные котлы, горелки, конденсатоотводчики, теплообменники и сосуды.",
    all_svc="Все услуги →", brands_l="Бренды, которые мы поставляем", brands_h="Доступ к производителям энергетических проектов",
    ev_l="Публикуемые доказательства", ev_h="Как мы делимся историей поставок", ev_p="Объём, стандарты, качество и поставка — без имён клиентов.",
    ev1="Трубопроводы и арматура", ev1p="Технологические линии НПЗ и нефтехимии по ASME, API и NACE — с MTC 3.1.",
    ev2="Электрика и КИП", ev2p="Преобразователи, расходомеры, распределительные щиты и автоматизация.",
    cases="Кейсы →", faq_l="FAQ", faq_h="Вопросы, которые закупки задают первыми",
    q1="Какие категории оборудования вы поставляете?", a1="Трубопроводы, фланцы, фитинги, арматура, КИП, электрика, насосы и компрессоры — по vendor list проекта с полной документацией качества.",
    q2="Как запросить предложение?", a2="Пришлите даташиты, количества, условия поставки и утверждённый vendor list. Мы проверяем каждую строку и возвращаем цену с обязательствами по документам.",
    q3="Предоставляете ли сертификаты завода и инспекцию?", a3="Да. MTC 3.1/3.2, TPI (Bureau Veritas, SGS, DNV), НК и PMI по договору.",
    q4="Можете ли соблюдать проектный vendor list?", a4="Соответствие vendor list — ключевая компетенция. Мы работаем с брендами списков NIOC, NIGC, NPC и крупных EPC.",
    send="Отправить технический RFQ", addr="16 этаж, блок A, комплекс Tooba, бульвар Koohak, Тегеран",
    desk="Отдел продаж", open="Открыть стол RFQ", explore="Разделы", languages="Языки", contact="Контакты",
    foot="Специализированные поставки трубопроводов, электрики и КИП для энергетических и технологических проектов.",
    rights="© 2026 Pishro Tajhiz Fartak. Все права защищены.",
    about_title="О компании — поставщик промышленного оборудования | PTF",
    about_h1="О Pishro Tajhiz Fartak", about_sub="Инженерно-ориентированные промышленные поставки с 2014 года — штаб в Тегеране, фокус на Ближнем Востоке.",
    who="Кто мы", who_p="PTF — специализированный поставщик в Тегеране (рег. 578831, 2014). Мы обслуживаем нефть и газ, нефтехимию, сталь, цемент и энергетику.",
    how="Как мы работаем", how_p="Каждый RFQ до ценообразования сверяется с vendor list, даташитами и требованиями ASME / API / ASTM / ISO / IEC.",
    svc_title="Услуги поставки промышленного оборудования | PTF",
    svc_h1="Услуги поставки", svc_sub="Те же шесть направлений, что на персидском сайте — от ЗИП до консолидированного проектного пакета.",
    how_eng="Сотрудничество начинается с пакета RFQ. Инженеры проверяют построчно, ищут у одобренных производителей, ускоряют, инспектируют и поставляют.",
    proj_title="Проекты и кейсы | PTF",
    proj_h1="Проекты и кейсы", proj_sub="Публикуемые доказательства: объём, стандарты, качество и результат — личность клиента конфиденциальна.",
    c1t="НПЗ нефти и газа", c1h="Трубопровод высокого давления Class 1500", c1p="Бесшовная труба A106 Gr.B и фланцы WN ASME B16.5, NACE MR0175, поставка с MTC 3.1.",
    c2t="Нефтехимия", c2h="Датчики перепада и расходомеры", c2p="Rosemount 3051 и KROHNE для планового останова — ATEX, калибровка, SIL 2.",
    c3t="Сталь", c3h="РУ НН и MCC", c3p="Siemens 3WL ACB, MCCB и ПЛК ABB для расширения прокатного стана, с сертификатом FAT.",
    c4t="Сбор газа", c4h="Шаровые краны API 6D trunnion", c4p="Class 600–1500 с пневмоприводами, PMI и заводскими сертификатами.",
    c5t="Сернистая среда", c5h="Пакет прокладок NACE", c5p="Спирально-навитые и кампрофиль с сердечником 316 SS для H₂S, ASME B16.20 / NACE MR0175.",
),
}

HEADER = """<!doctype html>
<html lang="{html_lang}" dir="ltr">
<head>
{icons}
<title>{title}</title>
<meta name="description" content="{desc}" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<link rel="canonical" href="https://pishtaj.ir/{code}/{page}" />
{hreflang}
<meta property="og:locale" content="{og}" />
<meta property="og:title" content="{title}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://pishtaj.ir/{code}/{page}" />
<meta property="og:image" content="https://pishtaj.ir/assets/images/real/real-hero-energy-plant.jpg" />
<link rel="stylesheet" href="../assets/css/style.css" />
<link rel="stylesheet" href="../assets/css/i18n.css" />
</head>
<body class="ix-body">
<a class="ptf-skip" href="#main-content">{skip}</a>
<header class="site-header ix-header scrolled" id="top">
  <div class="container nav-wrap">
    <a class="brand" href="./"><img src="../assets/images/ptf-logo.png" alt="PTF" width="66" height="66" style="object-fit:contain"><span><b>{brand}</b><small>{brand_s}</small></span></a>
    <button class="ix-menu" id="menuToggle" type="button" aria-label="{menu}" aria-controls="mainNav" aria-expanded="false"><span></span><span></span><span></span></button>
    <nav class="main-nav" id="mainNav">
      <a href="./"{a_home}>{nav_home}</a><a href="services.html"{a_svc}>{nav_svc}</a><a href="about.html"{a_about}>{nav_about}</a><a href="projects.html"{a_proj}>{nav_proj}</a><a href="../rfq/">{nav_rfq}</a><a href="./#contact">{nav_contact}</a>
    </nav>
    <a class="header-call" href="tel:+982146087679" dir="ltr">+98 21 46087679</a>
    <a href="../" class="lang-switch" aria-label="{langs}">{flag}</a>
  </div>
</header>
"""

FOOTER = """<footer class="ix-foot">
  <div class="container ix-foot-grid">
    <div><b>{brand}</b><p>{foot}</p></div>
    <div><b>{explore}</b><p style="display:grid;gap:8px"><a href="about.html">{nav_about}</a><a href="services.html">{nav_svc}</a><a href="projects.html">{nav_proj}</a><a href="../rfq/">{nav_rfq}</a></p></div>
    <div><b>{languages}</b><p style="display:grid;gap:8px">{langs_foot}</p></div>
    <div><b>{contact}</b><p><a href="tel:+982146087679" dir="ltr">+98 21 46087679</a><br><a href="mailto:Info@pishrotajheez.ir">Info@pishrotajheez.ir</a></p></div>
  </div>
  <div class="container" style="border-top:1px solid rgba(255,255,255,.08);padding-top:16px;font-size:13px;color:#64748b">{rights}</div>
</footer>
{menu_js}
</body>
</html>
"""

def header(code, t, page, active):
    def act(name):
        return ' class="active"' if active == name else ""
    pg = "" if page == "index.html" else page
    return HEADER.format(
        html_lang=t["html_lang"], icons=HEAD_ICONS, title=t.get("_title", t["title"]), desc=t.get("_desc", t["desc"]),
        code=code, page=pg, hreflang=HREFLANG.format(page=pg), og=t["og"],
        skip=t["skip"], brand=t["brand"], brand_s=t["brand_s"], menu=t["menu"],
        nav_home=t["nav_home"], nav_svc=t["nav_svc"], nav_about=t["nav_about"], nav_proj=t["nav_proj"],
        nav_rfq=t["nav_rfq"], nav_contact=t["nav_contact"], langs=t["langs"], flag=FLAGS[code],
        a_home=act("home"), a_svc=act("svc"), a_about=act("about"), a_proj=act("proj"),
    )

def footer(t):
    return FOOTER.format(
        brand=t["brand"], foot=t["foot"], explore=t["explore"], nav_about=t["nav_about"],
        nav_svc=t["nav_svc"], nav_proj=t["nav_proj"], nav_rfq=t["nav_rfq"], languages=t["languages"],
        langs_foot=LANGS_FOOT, contact=t["contact"], rights=t["rights"], menu_js=MENU_JS,
    )

def home(code, t):
    chips = "".join(f'<a class="ix-chip" href="services.html">{c}</a>' for c in t["chip"])
    t["_title"] = t["title"]; t["_desc"] = t["desc"]
    return header(code, t, "index.html", "home") + f"""
<main id="main-content">
  <section class="ix-hero">
    <div class="ix-hero-bg" style="background-image:url('../assets/images/real/real-hero-energy-plant.jpg')"></div>
    <div class="ix-hero-mask"></div>
    <div class="container">
      <span class="ix-kicker"><i></i> {t['kicker']}</span>
      <h1>{t['h1a']}<strong>{t['h1b']}</strong>{t['h1c']}</h1>
      <p>{t['hero']}</p>
      <div class="ix-actions">
        <a class="btn btn-primary" href="../rfq/">{t['cta_rfq']}</a>
        <a class="btn btn-ghost" href="#contact">{t['cta_sales']}</a>
      </div>
      <div class="ix-chips">{chips}</div>
    </div>
  </section>
  <section class="ix-trust"><div class="container ix-trust-grid">
    <div class="ix-trust-item"><b>{t['t14']}</b><span>{t['t14s']}</span></div>
    <div class="ix-trust-item"><b>{t['trfq']}</b><span>{t['trfqs']}</span></div>
    <div class="ix-trust-item"><b>{t['tavl']}</b><span>{t['tavls']}</span></div>
    <div class="ix-trust-item"><b>{t['tiso']}</b><span>{t['tisos']}</span></div>
  </div></section>
  <section class="ix-sec" style="background:#f8fafc"><div class="container">
    <span class="ix-label">{t['role_l']}</span><h2>{t['role_h']}</h2><p class="ix-lead">{t['role_p']}</p>
    <div class="ix-grid ix-grid-4">
      <a class="ix-card" href="../rfq/"><h3>{t['r1h']}</h3><p>{t['r1p']}</p></a>
      <a class="ix-card" href="services.html"><h3>{t['r2h']}</h3><p>{t['r2p']}</p></a>
      <a class="ix-card" href="../tracking/"><h3>{t['r3h']}</h3><p>{t['r3p']}</p></a>
      <a class="ix-card" href="../supplier/"><h3>{t['r4h']}</h3><p>{t['r4p']}</p></a>
    </div>
  </div></section>
  <section class="ix-sec" style="background:#fff"><div class="container">
    <span class="ix-label">{t['why_l']}</span><h2>{t['why_h']}</h2>
    <div class="ix-grid ix-grid-4">
      <article class="ix-card"><h3>{t['w1h']}</h3><p>{t['w1p']}</p></article>
      <article class="ix-card"><h3>{t['w2h']}</h3><p>{t['w2p']}</p></article>
      <article class="ix-card"><h3>{t['w3h']}</h3><p>{t['w3p']}</p></article>
      <article class="ix-card"><h3>{t['w4h']}</h3><p>{t['w4p']}</p></article>
    </div>
  </div></section>
  <section class="ix-sec" id="about"><div class="container">
    <div class="ix-board">
      <figure><img src="../assets/images/certificates/chairman.webp" alt="{t['chair']}" width="400" height="533" loading="lazy"></figure>
      <div><span class="ix-label">{t['board']}</span><h3>{t['chair']}</h3><p style="color:#64748b;font-weight:800;margin:0 0 10px">{t['chair_r']}</p><p style="color:#475569;font-size:15px;line-height:1.85;margin:0">{t['chair_p']}</p></div>
    </div>
    <div class="ix-photo-pair">
      <img class="main" src="../assets/images/real/closeup-pump.jpg" alt="" loading="lazy" width="1408" height="768">
      <div>
        <span class="ix-label">{t['about_l']}</span><h2>{t['about_h']}</h2><p class="ix-lead">{t['about_p']}</p>
        <ul class="ix-list">{''.join(f'<li>{x}</li>' for x in t['li'])}</ul>
      </div>
    </div>
  </div></section>
  <section class="ix-sec" id="services" style="background:linear-gradient(180deg,#fff,#f1f2f4)"><div class="container">
    <span class="ix-label">{t['svc_l']}</span><h2>{t['svc_h']}</h2><p class="ix-lead">{t['svc_p']}</p>
    <div class="ix-grid ix-grid-3">
      <article class="ix-card"><img src="../assets/images/real/piping-flanges.jpeg" alt="" loading="lazy"><h3>{t['s1']}</h3><p>{t['s1p']}</p></article>
      <article class="ix-card"><h3>{t['s2']}</h3><p>{t['s2p']}</p></article>
      <article class="ix-card"><img src="../assets/images/real/electrical-switchgear.jpeg" alt="" loading="lazy"><h3>{t['s3']}</h3><p>{t['s3p']}</p></article>
      <article class="ix-card"><img src="../assets/images/real/instrumentation-equipment.jpeg" alt="" loading="lazy"><h3>{t['s4']}</h3><p>{t['s4p']}</p></article>
      <article class="ix-card"><h3>{t['s5']}</h3><p>{t['s5p']}</p></article>
      <article class="ix-card"><img src="../assets/images/real/boilers-generic.jpeg" alt="" loading="lazy"><h3>{t['s6']}</h3><p>{t['s6p']}</p></article>
    </div>
    <p style="margin:28px 0 0"><a class="btn btn-primary" href="services.html">{t['all_svc']}</a></p>
  </div></section>
  <section class="ix-sec"><div class="container">
    <span class="ix-label">{t['brands_l']}</span><h2>{t['brands_h']}</h2>
    <div class="ix-brands"><span>Tenaris</span><span>ArcelorMittal</span><span>Sumitomo</span><span>Vallourec</span><span>KITZ</span><span>Siemens</span><span>ABB</span><span>Schneider</span><span>Emerson</span><span>Rosemount</span><span>Yokogawa</span><span>WIKA</span></div>
  </div></section>
  <section class="ix-sec ix-dark" id="projects"><div class="container">
    <span class="ix-label" style="color:#ffb033">{t['ev_l']}</span><h2>{t['ev_h']}</h2><p class="ix-lead">{t['ev_p']}</p>
    <div class="ix-grid ix-grid-2">
      <article class="ix-card"><h3>{t['ev1']}</h3><p>{t['ev1p']}</p></article>
      <article class="ix-card"><h3>{t['ev2']}</h3><p>{t['ev2p']}</p></article>
    </div>
    <p style="margin:28px 0 0"><a class="btn btn-primary" href="projects.html">{t['cases']}</a></p>
  </div></section>
  <section class="ix-sec" id="faq"><div class="container">
    <span class="ix-label">{t['faq_l']}</span><h2>{t['faq_h']}</h2>
    <div class="ix-faq">
      <details open><summary>{t['q1']}</summary><p>{t['a1']}</p></details>
      <details><summary>{t['q2']}</summary><p>{t['a2']}</p></details>
      <details><summary>{t['q3']}</summary><p>{t['a3']}</p></details>
      <details><summary>{t['q4']}</summary><p>{t['a4']}</p></details>
    </div>
  </div></section>
  <section class="ix-sec" id="contact" style="background:linear-gradient(180deg,#f8fafc,#eff6ff)"><div class="container">
    <div class="ix-cta">
      <div><h2>{t['send']}</h2><p>{t['desk']} <a href="tel:+982146087679" dir="ltr" style="color:#ffb033;font-weight:900">+98 21 46087679</a> · <a href="mailto:Info@pishrotajheez.ir" style="color:#ffb033">Info@pishrotajheez.ir</a><br>{t['addr']}</p></div>
      <div class="ix-actions"><a class="btn btn-primary" href="../rfq/">{t['open']}</a><a class="btn btn-ghost" href="https://wa.me/989925868479" target="_blank" rel="noopener">WhatsApp</a></div>
    </div>
  </div></section>
</main>
""" + footer(t)

def inner(code, t, page, active, h1, sub, body, title_key, desc=None):
    t = dict(t)
    t["_title"] = t[title_key]
    t["_desc"] = desc or t["desc"]
    return header(code, t, page, active) + f"""
<section class="ix-pg"><div class="container"><h1>{h1}</h1><p>{sub}</p></div></section>
<section class="ix-sec"><div class="container">{body}</div></section>
""" + footer(t)

def about(code, t):
    body = f"""
<div class="ix-trust-grid" style="margin-bottom:36px">
  <div class="ix-trust-item"><b>+14</b><span>{t['t14s']}</span></div>
  <div class="ix-trust-item"><b>40+</b><span></span></div>
  <div class="ix-trust-item"><b>ISO</b><span>9001 / 10002 / 10004</span></div>
  <div class="ix-trust-item"><b>EPC</b><span></span></div>
</div>
<div class="ix-board">
  <figure><img src="../assets/images/certificates/chairman.webp" alt="{t['chair']}" width="400" height="533" loading="lazy"></figure>
  <div><span class="ix-label">{t['board']}</span><h3>{t['chair']}</h3><p class="ix-lead" style="margin:0">{t['chair_p']}</p></div>
</div>
<div class="ix-card" style="max-width:860px">
  <h2>{t['who']}</h2><p class="ix-lead">{t['who_p']}</p>
  <h3>{t['how']}</h3><p class="ix-lead">{t['how_p']}</p>
  <p><b>{t['addr']}</b><br><span dir="ltr">+98 21 46087679</span><br>Info@pishrotajheez.ir</p>
  <p style="margin-top:18px"><a class="btn btn-primary" href="services.html">{t['all_svc']}</a></p>
</div>"""
    return inner(code, t, "about.html", "about", t["about_h1"], t["about_sub"], body, "about_title")

def services(code, t):
    body = f"""
<div class="ix-grid ix-grid-3">
  <article class="ix-card"><img src="../assets/images/real/piping-flanges.jpeg" alt="" loading="lazy"><h3>{t['s1']}</h3><p>{t['s1p']}</p></article>
  <article class="ix-card"><h3>{t['s2']}</h3><p>{t['s2p']}</p></article>
  <article class="ix-card"><img src="../assets/images/real/electrical-switchgear.jpeg" alt="" loading="lazy"><h3>{t['s3']}</h3><p>{t['s3p']}</p></article>
  <article class="ix-card"><img src="../assets/images/real/instrumentation-equipment.jpeg" alt="" loading="lazy"><h3>{t['s4']}</h3><p>{t['s4p']}</p></article>
  <article class="ix-card"><h3>{t['s5']}</h3><p>{t['s5p']}</p></article>
  <article class="ix-card"><h3>{t['s6']}</h3><p>{t['s6p']}</p></article>
</div>
<p class="ix-lead" style="margin-top:32px">{t['how_eng']}</p>
<p><a class="btn btn-primary" href="../rfq/">{t['cta_rfq']}</a></p>"""
    return inner(code, t, "services.html", "svc", t["svc_h1"], t["svc_sub"], body, "svc_title")

def projects(code, t):
    body = f"""
<div style="display:grid;gap:18px;max-width:900px">
  <article class="ix-card"><span class="ix-label">{t['c1t']}</span><h3>{t['c1h']}</h3><p>{t['c1p']}</p></article>
  <article class="ix-card"><span class="ix-label">{t['c2t']}</span><h3>{t['c2h']}</h3><p>{t['c2p']}</p></article>
  <article class="ix-card"><span class="ix-label">{t['c3t']}</span><h3>{t['c3h']}</h3><p>{t['c3p']}</p></article>
  <article class="ix-card"><span class="ix-label">{t['c4t']}</span><h3>{t['c4h']}</h3><p>{t['c4p']}</p></article>
  <article class="ix-card"><span class="ix-label">{t['c5t']}</span><h3>{t['c5h']}</h3><p>{t['c5p']}</p></article>
</div>"""
    return inner(code, t, "projects.html", "proj", t["proj_h1"], t["proj_sub"], body, "proj_title")

def main():
    urls = []
    for code, t in L.items():
        d = ROOT / code
        d.mkdir(exist_ok=True)
        pages = {
            "index.html": home(code, t),
            "about.html": about(code, t),
            "services.html": services(code, t),
            "projects.html": projects(code, t),
        }
        for name, html in pages.items():
            (d / name).write_text(html, encoding="utf-8")
            loc = f"https://pishtaj.ir/{code}/" if name == "index.html" else f"https://pishtaj.ir/{code}/{name}"
            urls.append(loc)
            print("wrote", d / name, "bytes", len(html.encode()))
    sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u in urls:
        sm.append(f"  <url><loc>{u}</loc><lastmod>2026-09-17</lastmod><priority>0.6</priority></url>")
    sm.append("</urlset>")
    (ROOT / "sitemap-i18n.xml").write_text("\n".join(sm) + "\n", encoding="utf-8")
    print("sitemap", len(urls))

if __name__ == "__main__":
    main()
