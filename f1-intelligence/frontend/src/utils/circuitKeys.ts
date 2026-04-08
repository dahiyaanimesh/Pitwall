// Maps circuit_id patterns from DB to Multiviewer API circuit keys
// Verified by brute-force scan of api.multiviewer.app/api/v1/circuits/{key}/{year}

// Confirmed working keys (from scan):
//  2=Silverstone  4=Hungaroring  6=Imola  7=Spa  9=Austin  10=Melbourne
//  14=Interlagos  15=Catalunya   19=Spielberg   22=Monaco  23=Montreal
//  28=Paul Ricard 39=Monza       46=Suzuka      49=Shanghai 55=Zandvoort
//  59=Istanbul    61=Singapore   63=Sakhir      65=MexicoCity 70=YasMarina
//  72=Nürburgring 79=Sochi       149=Jeddah     151=Miami   152=LasVegas

const KEYWORD_MAP: Array<[string, number]> = [
  // Bahrain / Sakhir
  ['bahrain',        63],
  ['sakhir',         63],
  ['gulf_air',       63],
  // Imola / Emilia Romagna
  ['imola',           6],
  ['emilia',          6],
  ['made_in_italy',   6],
  ['pirelli_gran_premio_del_made', 6],
  // Portimao — not in API, no key available
  // Spain / Catalunya
  ['catalunya',      15],
  ['spain',          15],
  ['espana',         15],
  ['españa',         15],
  ['gran_premio_de_espa', 15],
  ['aramco_gran_premio_de_espa', 15],
  ['aws_gran_premio_de_espa', 15],
  // Monaco
  ['monaco',         22],
  ['monte_carlo',    22],
  ['grand_prix_de_monaco', 22],
  // Azerbaijan / Baku — not in API
  // France / Paul Ricard
  ['france',         28],
  ['paul_ricard',    28],
  ['grand_prix_de_france', 28],
  ['emirates_grand_prix_de_france', 28],
  ['lenovo_grand_prix_de_france', 28],
  // Austria / Spielberg (Styria same circuit)
  ['austria',        19],
  ['spielberg',      19],
  ['steiermark',     19],
  ['grosser_preis',  19],
  // Britain / Silverstone
  ['britain',         2],
  ['british',         2],
  ['silverstone',     2],
  // Hungary / Hungaroring
  ['hungaroring',     4],
  ['hungary',         4],
  ['hungarian',       4],
  ['magyar',          4],
  // Belgium / Spa
  ['belgium',         7],
  ['belgian',         7],
  ['spa',             7],
  // Netherlands / Zandvoort
  ['netherlands',    55],
  ['dutch',          55],
  ['zandvoort',      55],
  // Italy / Monza
  ['monza',          39],
  ['gran_premio_d_italia', 39],
  ['gran_premio_d\'italia', 39],
  ['heineken_gran_premio_d', 39],
  ['pirelli_gran_premio_d', 39],
  ['msc_cruises_gran_premio_d', 39],
  ['italy',          39],
  ['italia',         39],
  // Russia / Sochi
  ['russia',         79],
  ['russian',        79],
  ['sochi',          79],
  ['vtb_russian',    79],
  // Turkey / Istanbul
  ['turkey',         59],
  ['turkish',        59],
  ['istanbul',       59],
  // USA / Austin / COTA
  ['united_states',   9],
  ['austin',          9],
  ['cota',            9],
  ['aramco_united_states', 9],
  ['lenovo_united_states', 9],
  ['pirelli_united_states', 9],
  // Mexico City
  ['mexico',         65],
  ['ciudad_de_m',    65],
  ['gran_premio_de_la_ciudad', 65],
  ['heineken_gran_premio_de_la_ciudad', 65],
  // Brazil / Interlagos
  ['brazil',         14],
  ['paulo',          14],
  ['interlagos',     14],
  ['heineken_grande_pr',  14],
  ['lenovo_grande_pr',    14],
  // Australia / Melbourne
  ['australia',      10],
  ['australian',     10],
  ['melbourne',      10],
  ['heineken_australian', 10],
  // Canada / Montreal
  ['canada',         23],
  ['canadian',       23],
  ['montreal',       23],
  ['grand_prix_du_canada', 23],
  ['aws_grand_prix_du_canada', 23],
  ['pirelli_grand_prix_du_canada', 23],
  // Japan / Suzuka
  ['japan',          46],
  ['japanese',       46],
  ['suzuka',         46],
  ['honda_japanese', 46],
  ['lenovo_japanese', 46],
  ['msc_cruises_japanese', 46],
  // China / Shanghai
  ['china',          49],
  ['chinese',        49],
  ['shanghai',       49],
  ['lenovo_chinese', 49],
  // Saudi Arabia / Jeddah
  ['saudi',         149],
  ['jeddah',        149],
  ['stc_saudi',     149],
  // Singapore / Marina Bay
  ['singapore',      61],
  ['marina_bay',     61],
  // Abu Dhabi / Yas Marina
  ['abu_dhabi',      70],
  ['yas_marina',     70],
  ['yas marina',     70],
  ['etihad',         70],
  // Miami
  ['miami',         151],
  ['crypto',        151],
  // Las Vegas
  ['las_vegas',     152],
  ['las vegas',     152],
  ['heineken_silver', 152],
]

const cache = new Map<string, number | null>()

export function getCircuitKey(circuitId: string | undefined | null): number | null {
  if (!circuitId) return null
  const id = circuitId.toLowerCase()
  if (cache.has(id)) return cache.get(id)!

  for (const [keyword, key] of KEYWORD_MAP) {
    if (id.includes(keyword)) {
      cache.set(id, key)
      return key
    }
  }

  cache.set(id, null)
  return null
}
