export interface SeasonEditorial {
  headline: string
  italicWord: string
  sub: string
  months: string
  scPeriods: number
  scPerRace: string
  poleSub: string
  lapSub: string
  modelMae: number
  moments: { round: string; text: string; accent?: boolean }[]
}

export const SEASON_EDITORIAL: Record<number, SeasonEditorial> = {
  2021: {
    headline: 'Eleven points, one lap, and a championship decided by tyre age.',
    italicWord: 'one lap',
    sub: 'Pitwall reconstructs every decision point of 2021 — tyre degradation, pit windows, model recommendations — then replays the final 5 laps of Yas Marina to show where the season was actually won.',
    months: 'MAR — DEC',
    scPeriods: 41,
    scPerRace: '1.9 per race avg',
    poleSub: 'Avg quali gap VER→HAM',
    lapSub: '98,412 laps recorded',
    modelMae: 3.3,
    moments: [
      { round: 'R01 · Bahrain',    text: 'VER leads final lap — loses drive on last corner. HAM wins from nowhere.' },
      { round: 'R07 · Monaco',     text: 'PIT strategy blunder costs LEC the lead. SAI inherits podium.' },
      { round: 'R15 · Russia',     text: 'VER gambles on inters in dry. 5-sec penalty. HAM wins in rain.' },
      { round: 'R22 · Yas Marina', text: "Masi deploys SC on lap 57. VER pits, HAM doesn't. One lap decides everything.", accent: true },
    ],
  },
  2022: {
    headline: "A regulation reset, a new dynasty, and Ferrari's painful what-ifs.",
    italicWord: 'new dynasty',
    sub: 'The ground-effect era begins. Verstappen dominates but Leclerc leads early — Pitwall maps every strategy call, tyre choice and model prediction across 22 rounds.',
    months: 'MAR — NOV',
    scPeriods: 39,
    scPerRace: '1.8 per race avg',
    poleSub: 'Avg quali gap VER→LEC',
    lapSub: '102,140 laps recorded',
    modelMae: 3.1,
    moments: [
      { round: 'R01 · Bahrain',    text: 'LEC wins from pole. VER & PER both retire late — Ferrari smell blood.' },
      { round: 'R08 · Azerbaijan', text: 'LEC leads comfortably — engine failure hands VER 25 points.' },
      { round: 'R14 · Belgium',    text: 'Torrential rain. Race starts behind SC, lasts two laps. Farce at Spa.' },
      { round: 'R18 · Japan',      text: 'Red flag in wet. VER wins 75% distance — WCC sealed in the rain.', accent: true },
    ],
  },
  2023: {
    headline: 'Nineteen wins, one driver, and a record that may never be broken.',
    italicWord: 'one driver',
    sub: "Verstappen's dominant 2023 season laid bare by data. Pitwall traces every strategic advantage, tyre window, and model callout that built the most dominant year in F1 history.",
    months: 'MAR — NOV',
    scPeriods: 35,
    scPerRace: '1.6 per race avg',
    poleSub: 'Avg quali gap VER→PER',
    lapSub: '106,880 laps recorded',
    modelMae: 2.9,
    moments: [
      { round: 'R06 · Monaco',  text: 'ALO holds VER off for the entire race. One of the great defensive drives.' },
      { round: 'R09 · Canada',  text: 'VER wins from P6 grid — scythes through field on alternating strategy.' },
      { round: 'R13 · Hungary', text: '10 consecutive wins streak. No driver in history had done it before.' },
      { round: 'R17 · Japan',   text: 'WDC clinched with 6 rounds to spare. Dominant run ends at 19 wins.', accent: true },
    ],
  },
  2024: {
    headline: 'Six champions, seventeen winners, and the closest grid in a decade.',
    italicWord: 'seventeen winners',
    sub: 'The most competitive season in years. Pitwall tracks every undercut, tyre cliff, and prediction miss as McLaren and Red Bull trade blows across a 24-round marathon.',
    months: 'MAR — DEC',
    scPeriods: 44,
    scPerRace: '1.8 per race avg',
    poleSub: 'Avg quali gap NOR→VER',
    lapSub: '115,600 laps recorded',
    modelMae: 3.4,
    moments: [
      { round: 'R08 · Monaco',    text: 'NOR leads 60 laps — MCL pits him in clear air. LEC inherits a gift win.' },
      { round: 'R14 · Belgium',   text: 'VER holds off NOR by 2.9s on old hards. Last gasp Red Bull win of the year.' },
      { round: 'R21 · São Paulo', text: 'VER wins from P17 in the rain. Championship fight refuses to die.' },
      { round: 'R24 · Abu Dhabi', text: 'NOR clinches constructors for McLaren — first since 1998.', accent: true },
    ],
  },
}
