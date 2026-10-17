// Catálogo de estrellas brillantes (hasta magnitud ~4,5) y figuras de las constelaciones.
// Datos de dominio público (Yale Bright Star Catalogue / Hipparcos), época J2000,
// redondeados a la décima de minuto: de sobra para un mapa del cielo a simple vista.
// Cada estrella: [clave, ascensión recta (h m), declinación (° ′), magnitud, nombre opcional].
// La precesión hasta hoy (≈ 0,4° en 30 años) no se aprecia a esta escala y no se aplica.

const RAW = `
aUMa 11 03.7 +61 45 1.79 Dubhe
bUMa 11 01.8 +56 23 2.37 Merak
gUMa 11 53.8 +53 42 2.44 Phecda
dUMa 12 15.4 +57 02 3.31 Megrez
eUMa 12 54.0 +55 58 1.77 Alioth
zUMa 13 23.9 +54 56 2.23 Mizar
hUMa 13 47.5 +49 19 1.86 Alkaid
oUMa 08 30.3 +60 43 3.36
iUMa 08 59.2 +48 03 3.14
kUMa 09 03.6 +47 09 3.60
lUMa 10 17.1 +42 55 3.45
mUMa 10 22.3 +41 30 3.05
nUMa 11 18.5 +33 06 3.48
xUMa 11 18.2 +31 32 3.79
pUMa 11 09.7 +44 30 3.01
tUMa 09 32.9 +51 41 3.17
uUMa 09 51.0 +59 02 3.80
cUMa 11 46.1 +47 47 3.69
23UMa 09 31.5 +63 04 3.65
aUMi 02 31.8 +89 16 1.98 Polar
bUMi 14 50.7 +74 09 2.08 Kochab
gUMi 15 20.7 +71 50 3.05
dUMi 17 32.2 +86 35 4.35
eUMi 16 46.0 +82 02 4.21
zUMi 15 44.1 +77 48 4.32
hUMi 16 17.5 +75 45 4.95
aCas 00 40.5 +56 32 2.24 Schedar
bCas 00 09.2 +59 09 2.28 Caph
gCas 00 56.7 +60 43 2.47
dCas 01 25.8 +60 14 2.68 Ruchbah
eCas 01 54.4 +63 40 3.37
aCep 21 18.6 +62 35 2.45 Alderamin
bCep 21 28.7 +70 34 3.23
gCep 23 39.3 +77 38 3.21
zCep 22 10.9 +58 12 3.35
iCep 22 49.7 +66 12 3.52
dCep 22 29.2 +58 25 4.07
gDra 17 56.6 +51 29 2.23 Eltanin
bDra 17 30.4 +52 18 2.79
xDra 17 53.5 +56 52 3.75
nDra 17 32.3 +55 11 4.87
dDra 19 12.6 +67 40 3.07
eDra 19 48.2 +70 16 3.83
cDra 18 21.1 +72 44 3.57
zDra 17 08.8 +65 43 3.17
hDra 16 24.0 +61 31 2.73
tDra 16 01.9 +58 34 4.01
iDra 15 24.9 +58 58 3.29
aDra 14 04.4 +64 23 3.65 Thuban
kDra 12 33.5 +69 47 3.87
lDra 11 31.4 +69 20 3.84
aBoo 14 15.7 +19 11 -0.05 Arturo
eBoo 14 45.0 +27 04 2.37
hBoo 13 54.7 +18 24 2.68
gBoo 14 32.1 +38 18 3.03
dBoo 15 15.5 +33 19 3.47
bBoo 15 02.0 +40 23 3.49
rBoo 14 31.8 +30 22 3.58
zBoo 14 41.2 +13 44 3.78
aCrB 15 34.7 +26 43 2.23 Alphecca
bCrB 15 27.8 +29 06 3.66
tCrB 15 32.9 +31 22 4.14
gCrB 15 42.7 +26 18 3.81
dCrB 15 49.6 +26 04 4.63
eCrB 15 57.6 +26 53 4.15
aHer 17 14.6 +14 23 3.10
bHer 16 30.2 +21 29 2.77
zHer 16 41.3 +31 36 2.81
hHer 16 42.9 +38 55 3.53
pHer 17 15.0 +36 49 3.16
eHer 17 00.3 +30 56 3.92
dHer 17 15.0 +24 50 3.14
mHer 17 46.5 +27 43 3.42
iHer 17 39.5 +46 00 3.80
tHer 17 56.3 +37 15 3.86
gHer 16 21.9 +19 09 3.75
oHer 18 07.5 +28 46 3.83
aLyr 18 36.9 +38 47 0.03 Vega
eLyr 18 44.3 +39 40 4.67
zLyr 18 44.8 +37 36 4.36
bLyr 18 50.1 +33 22 3.52
gLyr 18 59.0 +32 41 3.25
dLyr 18 54.5 +36 54 4.30
aCyg 20 41.4 +45 17 1.25 Deneb
gCyg 20 22.2 +40 15 2.23 Sadr
eCyg 20 46.2 +33 58 2.48
dCyg 19 45.0 +45 08 2.87
bCyg 19 30.7 +27 58 3.08 Albireo
zCyg 21 12.9 +30 14 3.21
hCyg 19 56.3 +35 05 3.89
iCyg 19 29.7 +51 44 3.79
kCyg 19 17.1 +53 22 3.77
aAql 19 50.8 +08 52 0.76 Altair
gAql 19 46.3 +10 37 2.72
bAql 19 55.3 +06 24 3.71
zAql 19 05.4 +13 52 2.99
dAql 19 25.5 +03 07 3.36
tAql 20 11.3 -00 49 3.23
lAql 19 06.2 -04 53 3.43
hAql 19 52.5 +01 00 3.87
aSge 19 40.1 +18 01 4.37
bSge 19 41.0 +17 29 4.37
dSge 19 47.4 +18 32 3.82
gSge 19 58.8 +19 29 3.47
aDel 20 39.6 +15 55 3.77
bDel 20 37.5 +14 36 3.63
gDel 20 46.7 +16 07 4.27
dDel 20 43.5 +15 04 4.43
eDel 20 33.2 +11 19 4.03
aSco 16 29.4 -26 26 1.06 Antares
dSco 16 00.3 -22 37 2.29
bSco 16 05.4 -19 48 2.56
pSco 15 58.9 -26 07 2.89
sSco 16 21.2 -25 36 2.88
tSco 16 35.9 -28 13 2.82
eSco 16 50.2 -34 18 2.29
mSco 16 51.9 -38 03 3.04
zSco 16 54.6 -42 22 3.62
hSco 17 12.2 -43 14 3.33
qSco 17 37.3 -43 00 1.86
iSco 17 47.6 -40 08 2.99
kSco 17 42.5 -39 02 2.39
lSco 17 33.6 -37 06 1.62 Shaula
uSco 17 30.8 -37 18 2.70
rSco 15 56.9 -29 13 3.87
eSgr 18 24.2 -34 23 1.85
sSgr 18 55.3 -26 18 2.02 Nunki
zSgr 19 02.6 -29 53 2.60
dSgr 18 21.0 -29 50 2.70
lSgr 18 28.0 -25 25 2.81
gSgr 18 05.8 -30 25 2.98
fSgr 18 45.7 -26 59 3.17
tSgr 19 06.9 -27 40 3.32
hSgr 18 17.6 -36 46 3.11
pSgr 19 09.8 -21 01 2.89
mSgr 18 13.8 -21 04 3.86
aOph 17 34.9 +12 34 2.07 Rasalhague
hOph 17 10.4 -15 44 2.43
zOph 16 37.2 -10 34 2.56
dOph 16 14.3 -03 42 2.74
eOph 16 18.3 -04 42 3.24
bOph 17 43.5 +04 34 2.77
kOph 16 57.7 +09 22 3.20
qOph 17 22.0 -25 00 3.27
nOph 17 59.0 -09 46 3.32
aSer 15 44.3 +06 26 2.63
mSer 15 49.6 -03 26 3.53
eSer 15 50.8 +04 29 3.71
bSer 15 46.2 +15 25 3.67
gSer 15 56.5 +15 40 3.85
dSer 15 34.8 +10 32 3.80
hSer 18 21.3 -02 54 3.26
qSer 18 56.2 +04 12 4.06
xSer 17 37.6 -15 24 3.54
aLib 14 50.9 -16 03 2.75
bLib 15 17.0 -09 23 2.61
sLib 15 04.1 -25 17 3.29
gLib 15 35.5 -14 47 3.91
uLib 15 37.0 -28 08 3.58
tLib 15 38.7 -29 47 3.66
aVir 13 25.2 -11 10 0.97 Espiga
gVir 12 41.7 -01 27 2.74
eVir 13 02.2 +10 58 2.85
zVir 13 34.7 -00 36 3.38
dVir 12 55.6 +03 24 3.38
bVir 11 50.7 +01 46 3.61
hVir 12 19.9 -00 40 3.89
tVir 14 01.6 +01 33 4.26
iVir 14 16.0 -06 00 4.07
qVir 13 10.0 -05 32 4.38
mVir 14 43.1 -05 40 3.88
109Vir 14 46.2 +01 54 3.72
aLeo 10 08.4 +11 58 1.36 Régulo
bLeo 11 49.1 +14 34 2.14 Denébola
gLeo 10 20.0 +19 51 2.01
dLeo 11 14.1 +20 31 2.56
qLeo 11 14.2 +15 26 3.33
eLeo 09 45.9 +23 46 2.98
mLeo 09 52.8 +26 00 3.88
zLeo 10 16.7 +23 25 3.44
hLeo 10 07.3 +16 46 3.48
bCnc 08 16.5 +09 11 3.52
dCnc 08 44.7 +18 09 3.94
gCnc 08 43.3 +21 28 4.66
iCnc 08 46.7 +28 46 4.02
aCnc 08 58.5 +11 52 4.25
bGem 07 45.3 +28 02 1.14 Pólux
aGem 07 34.6 +31 53 1.58 Cástor
gGem 06 37.7 +16 24 1.92
eGem 06 43.9 +25 08 2.98
mGem 06 23.0 +22 31 2.88
hGem 06 14.9 +22 30 3.28
dGem 07 20.1 +21 59 3.53
xGem 06 45.3 +12 54 3.36
zGem 07 04.1 +20 34 3.79
kGem 07 44.4 +24 24 3.57
lGem 07 18.1 +16 32 3.58
iGem 07 25.7 +27 48 3.78
tGem 07 11.1 +30 15 4.41
qGem 06 52.8 +33 58 3.60
nGem 06 29.0 +20 13 4.15
aCMi 07 39.3 +05 14 0.34 Proción
bCMi 07 27.2 +08 17 2.89
aOri 05 55.2 +07 24 0.42 Betelgeuse
bOri 05 14.5 -08 12 0.13 Rigel
gOri 05 25.1 +06 21 1.64 Bellatrix
eOri 05 36.2 -01 12 1.69
zOri 05 40.8 -01 57 1.77
dOri 05 32.0 -00 18 2.23
kOri 05 47.8 -09 40 2.06
lOri 05 35.1 +09 56 3.39
p3Ori 04 49.8 +06 58 3.19
p2Ori 04 50.6 +08 54 4.35
p4Ori 04 51.2 +05 36 3.69
p5Ori 04 54.3 +02 26 3.71
hOri 05 24.5 -02 24 3.35
iOri 05 35.4 -05 55 2.77
mOri 06 02.4 +09 39 4.12
xOri 06 11.9 +14 13 4.48
nOri 06 07.6 +14 46 4.42
aTau 04 35.9 +16 31 0.85 Aldebarán
bTau 05 26.3 +28 36 1.65 Elnath
hTau 03 47.5 +24 06 2.87
zTau 05 37.6 +21 09 3.00
q2Tau 04 28.7 +15 52 3.40
lTau 04 00.7 +12 29 3.47
eTau 04 28.6 +19 11 3.53
gTau 04 19.8 +15 38 3.65
dTau 04 22.9 +17 33 3.76
oTau 03 24.8 +09 02 3.60
xTau 03 27.2 +09 44 3.73
27Tau 03 49.2 +24 03 3.62
17Tau 03 44.9 +24 07 3.70
20Tau 03 45.8 +24 22 3.87
23Tau 03 46.3 +23 57 4.18
aAur 05 16.7 +46 00 0.08 Capella
bAur 05 59.5 +44 57 1.90
qAur 05 59.7 +37 13 2.62
iAur 04 57.0 +33 10 2.69
eAur 05 02.0 +43 49 2.99
hAur 05 06.5 +41 14 3.17
zAur 05 02.5 +41 05 3.75
aPer 03 24.3 +49 52 1.79 Mirfak
bPer 03 08.2 +40 57 2.12 Algol
zPer 03 54.1 +31 53 2.85
ePer 03 57.9 +40 01 2.89
gPer 03 04.8 +53 30 2.93
dPer 03 42.9 +47 47 3.01
rPer 03 05.2 +38 50 3.39
hPer 02 50.7 +55 54 3.76
xPer 03 59.0 +35 48 4.04
nPer 03 45.2 +42 35 3.77
kPer 03 09.5 +44 52 3.80
aAnd 00 08.4 +29 05 2.06 Alpheratz
bAnd 01 09.7 +35 37 2.05 Mirach
gAnd 02 03.9 +42 20 2.10 Almach
dAnd 00 39.3 +30 52 3.27
mAnd 00 56.8 +38 30 3.86
nAnd 00 49.8 +41 05 4.53
pAnd 00 36.9 +33 43 4.34
oAnd 23 01.9 +42 20 3.62
lAnd 23 37.6 +46 28 3.82
kAnd 23 40.4 +44 20 4.15
iAnd 23 38.1 +43 16 4.29
aPeg 23 04.8 +15 12 2.49 Markab
bPeg 23 03.8 +28 05 2.42 Scheat
gPeg 00 13.2 +15 11 2.83 Algenib
ePeg 21 44.2 +09 53 2.39 Enif
zPeg 22 41.5 +10 50 3.40
hPeg 22 43.0 +30 13 2.94
qPeg 22 10.2 +06 12 3.53
mPeg 22 50.0 +24 36 3.48
lPeg 22 46.5 +23 34 3.95
iPeg 22 07.0 +25 21 3.76
kPeg 21 44.6 +25 39 4.13
pPeg 22 10.0 +33 11 4.29
aAri 02 07.2 +23 28 2.01 Hamal
bAri 01 54.6 +20 48 2.64
gAri 01 53.5 +19 18 3.88
41Ari 02 50.0 +27 16 3.61
aTri 01 53.1 +29 35 3.41
bTri 02 09.5 +34 59 3.00
gTri 02 17.3 +33 51 4.01
hPsc 01 31.5 +15 21 3.62
gPsc 23 17.2 +03 17 3.69
bAqr 21 31.6 -05 34 2.87
aAqr 22 05.8 -00 19 2.94
dAqr 22 54.7 -15 49 3.27
zAqr 22 28.8 -00 01 3.65
gAqr 22 21.7 -01 23 3.84
hAqr 22 35.4 -00 07 4.02
lAqr 22 52.6 -07 35 3.73
eAqr 20 47.7 -09 30 3.77
qAqr 22 16.8 -07 47 4.16
iAqr 22 06.4 -13 52 4.27
dCap 21 47.0 -16 08 2.81
bCap 20 21.0 -14 47 3.05
aCap 20 18.1 -12 33 3.57
gCap 21 40.1 -16 40 3.68
zCap 21 26.7 -22 25 3.74
qCap 21 05.9 -17 14 4.07
wCap 20 51.8 -26 55 4.12
yCap 20 46.1 -25 16 4.13
aPsA 22 57.6 -29 37 1.16 Fomalhaut
ePsA 22 40.6 -27 03 4.17
dPsA 22 55.9 -32 32 4.21
aGru 22 08.2 -46 58 1.74
bGru 22 42.7 -46 53 2.07
gGru 21 53.9 -37 22 3.00
bCet 00 43.6 -17 59 2.04 Diphda
aCet 03 02.3 +04 05 2.54 Menkar
oCet 02 19.3 -02 59 3.04 Mira
gCet 02 43.3 +03 14 3.47
tCet 01 44.1 -15 56 3.50
iCet 00 19.4 -08 49 3.56
qCet 01 24.0 -08 11 3.60
hCet 01 08.6 -10 11 3.45
zCet 01 51.5 -10 20 3.73
dCet 02 39.5 +00 20 4.07
bEri 05 07.9 -05 05 2.79
gEri 03 58.0 -13 31 2.95
dEri 03 43.2 -09 46 3.54
eEri 03 32.9 -09 27 3.73
hEri 02 56.4 -08 54 3.89
nEri 04 36.3 -03 21 3.93
mEri 04 45.5 -03 15 4.00
o1Eri 04 11.9 -06 50 4.04
qEri 02 58.3 -40 18 2.88 Acamar
t4Eri 03 19.5 -21 45 3.69
aEri 01 37.7 -57 14 0.46 Achernar
aLep 05 32.7 -17 49 2.58
bLep 05 28.2 -20 46 2.84
eLep 05 05.5 -22 22 3.19
mLep 05 12.9 -16 12 3.31
zLep 05 47.0 -14 49 3.55
gLep 05 44.5 -22 27 3.60
dLep 05 51.3 -20 53 3.81
hLep 05 56.4 -14 10 3.71
aCMa 06 45.1 -16 43 -1.46 Sirio
eCMa 06 58.6 -28 58 1.50 Adhara
dCMa 07 08.4 -26 24 1.83 Wezen
bCMa 06 22.7 -17 57 1.98
hCMa 07 24.1 -29 18 2.45
zCMa 06 20.3 -30 04 3.02
o2CMa 07 03.0 -23 50 3.02
sCMa 07 01.7 -27 56 3.47
iCMa 06 56.1 -17 03 4.37
gCMa 07 03.8 -15 38 4.12
qCMa 06 54.2 -12 02 4.07
o1CMa 06 54.1 -24 11 3.87
kCMa 06 49.8 -32 31 3.96
zPup 08 03.6 -40 00 2.21 Naos
pPup 07 17.1 -37 06 2.70
rPup 08 07.5 -24 18 2.83
tPup 06 49.9 -50 37 2.93
nPup 06 37.8 -43 12 3.17
sPup 07 29.2 -43 18 3.25
xPup 07 49.3 -24 52 3.34
aCar 06 24.0 -52 42 -0.74 Canopo
bCar 09 13.2 -69 43 1.68
eCar 08 22.5 -59 31 1.86
g2Vel 08 09.5 -47 20 1.83
dVel 08 44.7 -54 43 1.96
lVel 09 08.0 -43 26 2.21
kVel 09 22.1 -55 01 2.50
mVel 10 46.8 -49 25 2.69
aCol 05 39.6 -34 04 2.65
bCol 05 51.0 -35 46 3.12
aCen 14 39.6 -60 50 -0.27 Rigil Kentaurus
bCen 14 03.8 -60 22 0.61 Hadar
qCen 14 06.7 -36 22 2.06 Menkent
eCen 13 39.9 -53 28 2.30
hCen 14 35.5 -42 10 2.31
gCen 12 41.5 -48 58 2.17
zCen 13 55.5 -47 17 2.55
iCen 13 20.6 -36 43 2.75
aCru 12 26.6 -63 06 0.77 Ácrux
bCru 12 47.7 -59 41 1.25 Mimosa
gCru 12 31.2 -57 07 1.63 Gacrux
dCru 12 15.1 -58 45 2.79
aLup 14 41.9 -47 23 2.30
bLup 14 58.5 -43 08 2.68
aTrA 16 48.7 -69 02 1.92 Atria
bTrA 15 55.1 -63 26 2.83
gTrA 15 18.9 -68 41 2.87
aPav 20 25.6 -56 44 1.94 Peacock
aAra 17 31.8 -49 53 2.95
bAra 17 25.3 -55 32 2.84
aHya 09 27.6 -08 40 1.98 Alphard
gHya 13 18.9 -23 10 3.00
zHya 08 55.4 +05 57 3.11
eHya 08 46.8 +06 25 3.38
dHya 08 37.7 +05 42 4.16
nHya 10 49.6 -16 12 3.11
pHya 14 06.4 -26 41 3.27
iHya 09 39.9 -01 09 3.91
lHya 10 10.6 -12 21 3.61
mHya 10 26.1 -16 50 3.81
xHya 11 33.0 -31 51 3.54
gCrv 12 15.8 -17 33 2.59
bCrv 12 34.4 -23 24 2.65
dCrv 12 29.9 -16 31 2.95
eCrv 12 10.1 -22 37 3.00
aCrv 12 08.4 -24 44 4.02
dCrt 11 19.3 -14 47 3.56
aCrt 10 59.8 -18 18 4.08
gCrt 11 24.9 -17 41 4.08
aLyn 09 21.1 +34 24 3.14
aCVn 12 56.0 +38 19 2.89
bCVn 12 33.7 +41 21 4.26
`;

// Figuras: cadenas de estrellas unidas por trazos.
export const FIGURES = [
  // Osa Mayor
  "hUMa zUMa eUMa dUMa gUMa bUMa aUMa dUMa", "aUMa 23UMa oUMa uUMa tUMa kUMa iUMa", "uUMa aUMa",
  "gUMa cUMa pUMa mUMa lUMa", "pUMa nUMa xUMa",
  // Osa Menor, Casiopea, Cefeo, Dragón
  "aUMi dUMi eUMi zUMi bUMi gUMi hUMi zUMi",
  "bCas aCas gCas dCas eCas",
  "aCep bCep gCep iCep zCep aCep", "bCep iCep", "zCep dCep",
  "lDra kDra aDra iDra tDra hDra zDra cDra eDra dDra xDra gDra bDra nDra xDra",
  // Boyero, Corona Boreal, Hércules
  "aBoo eBoo dBoo bBoo gBoo rBoo aBoo", "aBoo hBoo", "aBoo zBoo",
  "tCrB bCrB aCrB gCrB dCrB eCrB",
  "zHer hHer pHer eHer zHer", "zHer bHer gHer", "eHer dHer aHer", "dHer mHer oHer", "pHer tHer iHer",
  // Lira, Cisne, Águila, Flecha, Delfín
  "aLyr eLyr", "aLyr zLyr bLyr gLyr dLyr zLyr",
  "aCyg gCyg hCyg bCyg", "dCyg gCyg eCyg zCyg", "dCyg iCyg kCyg",
  "gAql aAql bAql", "zAql gAql", "aAql dAql lAql", "dAql hAql tAql",
  "aSge dSge gSge", "bSge dSge",
  "eDel bDel aDel gDel dDel bDel",
  // Escorpio, Sagitario, Ofiuco, Serpiente, Libra
  "bSco dSco pSco rSco", "dSco sSco aSco tSco eSco mSco zSco hSco qSco iSco kSco lSco uSco",
  "gSgr dSgr eSgr gSgr", "dSgr lSgr fSgr dSgr", "fSgr sSgr tSgr zSgr fSgr", "zSgr eSgr", "lSgr mSgr", "sSgr pSgr",
  "aOph bOph hOph zOph eOph dOph kOph aOph", "hOph qOph",
  "gSer bSer dSer aSer eSer mSer", "xSer hSer qSer",
  "sLib aLib bLib gLib aLib", "gLib uLib tLib",
  // Virgo, León, Cáncer, Géminis, Can Menor
  "bVir hVir gVir qVir aVir", "gVir dVir eVir", "dVir zVir tVir 109Vir", "aVir iVir mVir",
  "aLeo hLeo gLeo zLeo mLeo eLeo", "gLeo dLeo bLeo qLeo aLeo", "dLeo qLeo",
  "bCnc dCnc gCnc iCnc", "dCnc aCnc",
  "aGem tGem eGem mGem hGem", "eGem nGem", "tGem qGem", "bGem iGem tGem", "bGem kGem", "bGem dGem zGem gGem", "dGem lGem xGem",
  "aCMi bCMi",
  // Orión, Tauro, Auriga, Perseo
  "aOri lOri gOri", "gOri dOri eOri zOri aOri", "zOri kOri", "dOri hOri bOri", "gOri p3Ori", "p2Ori p3Ori p4Ori p5Ori", "aOri mOri xOri nOri",
  "aTau q2Tau gTau dTau eTau bTau", "aTau zTau", "gTau lTau oTau xTau",
  "aAur bAur qAur bTau iAur aAur", "aAur eAur zAur hAur aAur",
  "hPer gPer aPer dPer nPer ePer xPer zPer", "aPer kPer bPer rPer",
  // Andrómeda, Pegaso, Aries, Triángulo
  "aAnd dAnd bAnd gAnd", "bAnd mAnd nAnd", "dAnd pAnd iAnd kAnd lAnd", "iAnd oAnd",
  "aPeg bPeg aAnd gPeg aPeg", "aPeg zPeg qPeg ePeg", "bPeg mPeg lPeg iPeg kPeg", "bPeg hPeg pPeg",
  "gAri bAri aAri 41Ari", "aTri bTri gTri aTri",
  // Acuario, Capricornio, Pez Austral, Grulla, Ballena, Erídano, Liebre
  "eAqr bAqr aAqr gAqr zAqr hAqr", "aAqr qAqr lAqr dAqr", "bAqr iAqr",
  "aCap bCap yCap wCap zCap dCap gCap qCap aCap",
  "ePsA aPsA dPsA", "gGru aGru bGru",
  "aCet gCet dCet oCet zCet qCet hCet bCet tCet zCet", "bCet iCet",
  "bEri mEri nEri o1Eri gEri dEri eEri hEri", "gEri t4Eri",
  "mLep aLep zLep hLep", "aLep bLep eLep mLep", "bLep gLep dLep aLep",
  // Can Mayor, Popa, Paloma, Vela
  "bCMa aCMa iCMa gCMa", "iCMa qCMa", "aCMa o1CMa dCMa hCMa", "dCMa eCMa zCMa", "eCMa kCMa", "o1CMa o2CMa dCMa", "eCMa sCMa",
  "rPup xPup zPup pPup nPup", "pPup sPup", "aCol bCol",
  "g2Vel dVel kVel", "g2Vel lVel mVel",
  // Cruz del Sur, Centauro, Triángulo Austral, Hidra, Cuervo, Copa, Lebreles
  "aCru gCru", "bCru dCru", "aCen bCen", "gCen eCen zCen hCen qCen iCen gCen",
  "aTrA bTrA gTrA aTrA",
  "dHya eHya zHya iHya aHya lHya mHya nHya xHya gHya pHya", "eHya dHya",
  "aCrv eCrv gCrv dCrv bCrv eCrv",
  "aCrt dCrt gCrt",
  "aCVn bCVn",
];

export const STARS = RAW.trim().split("\n").map((line) => {
  const [key, rh, rm, dd, dm, mag, ...name] = line.trim().split(/\s+/);
  const sign = dd.startsWith("-") ? -1 : 1;
  return {
    key,
    ra: (+rh + rm / 60) * 15, // grados
    dec: sign * (Math.abs(+dd) + dm / 60),
    mag: +mag,
    name: name.join(" ") || "",
  };
});
