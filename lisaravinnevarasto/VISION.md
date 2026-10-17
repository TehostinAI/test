# Visio: Lisäravinnevarasto

## Ongelma
Käytän päivittäin noin kymmentä lisäravinnetta. En halua laskea purkkeja käsin,
mutta en myöskään halua, että mikään loppuu yllättäen kesken.

## Käyttäjä
Minä itse, iPhonella ja iPadilla. Käytän laitteita vuorotellen, en yleensä
samaan aikaan. Avaan sovelluksen pari kertaa viikossa: kun avaan uuden purkin,
kun tarkistan saldon tai kun mietin, mitä pitää tilata.

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
8. Samat tiedot puhelimessa ja iPadissa: toisella laitteella tehty kirjaus
   näkyy toisella, kun avaan sovelluksen. En tee siirtoa käsin.

## Lähtötilanne
Nykyinen Claude-artefakti on toimiva prototyyppi. Uusi sovellus toimii samoin
ja näyttää samalta. Prototyypin 10 tuotetta tulevat mukaan valmiina lähtödatana.

## Mitä tämä EI ole
- Ei toimi Clauden varassa
- Ei kirjautumista eikä salasanoja. Liitän kerran jokaiseen laitteeseen
  salaisen avaimen, ja se riittää.
- Ei reaaliaikaista yhteiskäyttöä: laitteiden ei tarvitse päivittyä toistensa
  näytöille sekunneissa, kunhan tiedot ovat ajan tasalla avatessa
- Ei erillistä varmuuskopiotoimintoa. Tiedot säilyvät synkronoinnin kautta,
  joten laitteen vaihtuminen ei hävitä niitä.
- Ei useita käyttäjiä
- Ei tilaa mitään itse, eikä seuraa hintoja tai ostohistoriaa
- Ei ilmoituksia
- Ei uusia ominaisuuksia prototyyppiin verrattuna

## Rajoitteet
- Ilmainen: ei kuukausimaksuja
- Ei uusia palveluita tai tilejä: vain GitHub, joka on jo käytössä
- Nolla ylläpitoa: ei omia palvelimia, tietokantoja tai päivitettäviä
  riippuvuuksia
- Tuotelista ei saa olla julkinen tallennuspaikassa, johon kuka tahansa voi kirjoittaa
- Jos kaksi laitetta muuttaa tietoja ristiin, mikään kirjaus ei saa kadota
  huomaamatta. Sovellus saa pyytää minua tekemään kirjauksen uudelleen.
- Ilman nettiä sovellus näyttää viimeksi tiedossa olleet tiedot

## Onnistuminen
Avaan sovelluksen puhelimesta osoitteesta tai kotinäytön kuvakkeesta ilman
kirjautumista, ja se näyttää samat tiedot kuin edellisellä kerralla.
Käytän sitä prototyypin sijaan.

Kirjaan iPhonella uuden purkin, avaan iPadin sovelluksen, ja muutos näkyy siellä.
Sama toimii toiseen suuntaan.
