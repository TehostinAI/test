# Visio: Lisäravinnevarasto

## Ongelma
Käytän päivittäin noin kymmentä lisäravinnetta. En halua laskea purkkeja käsin,
mutta en myöskään halua, että mikään loppuu yllättäen kesken.

## Käyttäjä
Minä itse, omalla puhelimellani. Avaan sovelluksen pari kertaa viikossa:
kun avaan uuden purkin, kun tarkistan saldon tai kun mietin, mitä pitää tilata.

## Ydinidea
Saldo vähenee itsestään päivittäisen annostuksen mukaan. Kirjaan vain
poikkeukset: uuden purkin tai purkista lasketun todellisen määrän.

## Ydinominaisuudet
1. Tuotteen lisäys, muokkaus ja poisto (nimi, annos, kertaa päivässä,
   pakkauskoko, yksikkö, tilausraja päivinä, muistiinpano)
2. Arvioitu jäljellä oleva määrä ja päiviä jäljellä jokaiselle tuotteelle
3. Tila-merkintä: riittää / tilaa pian / loppunut
4. "+ Uusi purkki" lisää pakkauskoon saldoon yhdellä napautuksella
5. "Laskin saldon" korjaa arvion todelliseksi
6. Ostoslista tilausrajan alittaneista tuotteista ja sen kopiointi
7. Lista järjestetty niin, että ensimmäisenä loppuva on ylimpänä

## Lähtötilanne
Nykyinen Claude-artefakti on toimiva prototyyppi. Uusi sovellus toimii samoin
ja näyttää samalta. Prototyypin 10 tuotetta tulevat mukaan valmiina lähtödatana.

## Mitä tämä EI ole
- Ei toimi Clauden varassa: ei kirjautumista Claudeen tai mihinkään muualle
- Ei synkronointia laitteiden välillä, vain yksi puhelin
- Ei varmuuskopiointia: jos puhelin vaihtuu, syötän tuotteet uudelleen
- Ei useita käyttäjiä
- Ei tilaa mitään itse, eikä seuraa hintoja tai ostohistoriaa
- Ei ilmoituksia
- Ei uusia ominaisuuksia prototyyppiin verrattuna

## Rajoitteet
- Ilmainen: ei kuukausimaksuja
- Nolla ylläpitoa: ei palvelimia, tietokantoja tai päivitettäviä riippuvuuksia

## Onnistuminen
Avaan sovelluksen puhelimesta osoitteesta tai kotinäytön kuvakkeesta ilman
kirjautumista, ja se näyttää samat tiedot kuin edellisellä kerralla.
Käytän sitä prototyypin sijaan.
