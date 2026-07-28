const player = (name, role) => ({ name, role });

export const teams = [
  {
    id: "spain",
    name: "Spain",
    localName: "España",
    code: "ESP",
    colors: ["#aa151b", "#f1bf00", "#aa151b"],
    ink: "#6e171a",
    wash: "#e9d4b0",
    wallOpacity: 0.91,
    skyOpacity: 0.78,
    curtain: { width: 0.63, anchor: 0.31 },
    poem: "Red earth, gold light — a flag held together by twenty-six names.",
    architecture: "A tiled civic arcade, drawn from Spanish plazas and sun-baked eaves.",
    commentary: {
      file: "./audio/spain-qf-merino-88.mp3",
      line: "Mikel Merino — 88' winner vs Belgium",
      clips: [
        {
          file: "./audio/spain-opener-vs-belgium.mp3",
          line: "Spain break through against Belgium"
        },
        {
          file: "./audio/spain-qf-merino-88.mp3",
          line: "Mikel Merino — 88' winner vs Belgium"
        }
      ],
      sourceLabel: "FIFA on YouTube · Spain 2–1 Belgium",
      sourceUrl: "https://www.youtube.com/watch?v=VHoctq0AOg8",
      credit: "Official FIFA YouTube highlight"
    },
    sourceLabel: "FIFA squad announcement · 25 May 2026",
    sourceUrl: "https://www.fifa.com/en/articles/spain-squad-announcement-luis-de-la-fuente",
    players: [
      player("Unai Simón", "Goalkeepers"), player("David Raya", "Goalkeepers"), player("Joan García", "Goalkeepers"),
      player("Pedro Porro", "Defenders"), player("Marcos Llorente", "Defenders"), player("Aymeric Laporte", "Defenders"),
      player("Pau Cubarsí", "Defenders"), player("Marc Pubill", "Defenders"), player("Eric García", "Defenders"),
      player("Marc Cucurella", "Defenders"), player("Alejandro Grimaldo", "Defenders"),
      player("Rodri Hernández", "Midfielders"), player("Martín Zubimendi", "Midfielders"), player("Pedri González", "Midfielders"),
      player("Fabián Ruiz", "Midfielders"), player("Mikel Merino", "Midfielders"), player("Gavi Páez", "Midfielders"),
      player("Álex Baena", "Midfielders"),
      player("Mikel Oyarzabal", "Forwards"), player("Lamine Yamal", "Forwards"), player("Ferran Torres", "Forwards"),
      player("Borja Iglesias", "Forwards"), player("Dani Olmo", "Forwards"), player("Víctor Muñoz", "Forwards"),
      player("Nico Williams", "Forwards"), player("Yeremy Pino", "Forwards")
    ]
  },
  {
    id: "england",
    name: "England",
    localName: "England",
    code: "ENG",
    colors: ["#f3f0e6", "#ce1124", "#142a52"],
    ink: "#13264b",
    wash: "#dce1e4",
    wallOpacity: 0.87,
    skyOpacity: 0.62,
    curtain: { width: 0.57, anchor: 0.325 },
    poem: "White field, cardinal lines — names crossing like routes through a city.",
    architecture: "A Victorian station canopy in cast iron, glass and disciplined rhythm.",
    commentary: {
      file: "./audio/england-qf-bellingham-93.mp3",
      line: "England — extra-time comeback vs Norway",
      clips: [
        {
          file: "./audio/england-equalizer-vs-norway.mp3",
          line: "Jude Bellingham with the equaliser for England"
        },
        {
          file: "./audio/england-qf-bellingham-93.mp3",
          line: "England complete the extra-time comeback"
        },
        {
          file: "./audio/england-semi-final-whistle.mp3",
          line: "England are heading into the final four"
        }
      ],
      sourceLabel: "FIFA full highlights · Norway 1–2 England",
      sourceUrl: "https://www.youtube.com/watch?v=PnFUiq8m9os",
      credit: "Official FIFA YouTube highlight"
    },
    sourceLabel: "England Football · updated 17 June 2026",
    sourceUrl: "https://www.englandfootball.com/articles/2026/May/22/england-mens-world-cup-2026-squad-named-by-thomas-tuchel-20262205",
    players: [
      player("Dean Henderson", "Goalkeepers"), player("Jordan Pickford", "Goalkeepers"), player("James Trafford", "Goalkeepers"),
      player("Dan Burn", "Defenders"), player("Trevoh Chalobah", "Defenders"), player("Marc Guéhi", "Defenders"),
      player("Reece James", "Defenders"), player("Ezri Konsa", "Defenders"), player("Nico O'Reilly", "Defenders"),
      player("Jarell Quansah", "Defenders"), player("Djed Spence", "Defenders"), player("John Stones", "Defenders"),
      player("Elliot Anderson", "Midfielders"), player("Jude Bellingham", "Midfielders"), player("Eberechi Eze", "Midfielders"),
      player("Jordan Henderson", "Midfielders"), player("Kobbie Mainoo", "Midfielders"), player("Declan Rice", "Midfielders"),
      player("Morgan Rogers", "Midfielders"),
      player("Anthony Gordon", "Forwards"), player("Harry Kane", "Forwards"), player("Noni Madueke", "Forwards"),
      player("Marcus Rashford", "Forwards"), player("Bukayo Saka", "Forwards"), player("Ivan Toney", "Forwards"),
      player("Ollie Watkins", "Forwards")
    ]
  },
  {
    id: "france",
    name: "France",
    localName: "France",
    code: "FRA",
    colors: ["#173b78", "#f3eee1", "#d82232"],
    ink: "#1d2f59",
    wash: "#d8d7cf",
    wallOpacity: 0.89,
    skyOpacity: 0.72,
    curtain: { width: 0.65, anchor: 0.36 },
    poem: "Blue, pale stone, red — a tricolour moving beneath a glass horizon.",
    architecture: "A Belle Époque metro entrance: curved glass, iron stems and Art Nouveau type.",
    commentary: {
      file: "./audio/france-qf-mbappe-60.mp3",
      line: "France — quarter-final control vs Morocco",
      clips: [
        {
          file: "./audio/france-qf-mbappe-60.mp3",
          line: "France find the breakthrough through Kylian Mbappé"
        },
        {
          file: "./audio/france-second-goal-vs-morocco.mp3",
          line: "France double their lead against Morocco"
        },
        {
          file: "./audio/france-semi-final-whistle.mp3",
          line: "France march into the semi-finals"
        }
      ],
      sourceLabel: "FIFA full highlights · France 2–0 Morocco",
      sourceUrl: "https://www.youtube.com/watch?v=Lfo49ZbV4WU",
      credit: "Official FIFA YouTube highlight"
    },
    sourceLabel: "FIFA squad announcement · 11 May 2026",
    sourceUrl: "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/france-world-cup-squad-named",
    players: [
      player("Mike Maignan", "Goalkeepers"), player("Robin Risser", "Goalkeepers"), player("Brice Samba", "Goalkeepers"),
      player("Lucas Digne", "Defenders"), player("Malo Gusto", "Defenders"), player("Lucas Hernández", "Defenders"),
      player("Theo Hernández", "Defenders"), player("Ibrahima Konaté", "Defenders"), player("Jules Koundé", "Defenders"),
      player("Maxence Lacroix", "Defenders"), player("William Saliba", "Defenders"), player("Dayot Upamecano", "Defenders"),
      player("N'Golo Kanté", "Midfielders"), player("Manu Koné", "Midfielders"), player("Adrien Rabiot", "Midfielders"),
      player("Aurélien Tchouaméni", "Midfielders"), player("Warren Zaïre-Emery", "Midfielders"),
      player("Maghnes Akliouche", "Forwards"), player("Bradley Barcola", "Forwards"), player("Rayan Cherki", "Forwards"),
      player("Ousmane Dembélé", "Forwards"), player("Désiré Doué", "Forwards"), player("Jean-Philippe Mateta", "Forwards"),
      player("Kylian Mbappé", "Forwards"), player("Michael Olise", "Forwards"), player("Marcus Thuram", "Forwards")
    ]
  },
  {
    id: "argentina",
    name: "Argentina",
    localName: "Argentina",
    code: "ARG",
    colors: ["#75aadb", "#f4f0e8", "#f6b40e"],
    ink: "#24547d",
    wash: "#d5e3e8",
    wallOpacity: 0.87,
    skyOpacity: 0.72,
    curtain: { width: 0.655, anchor: 0.36 },
    poem: "Sky, light, sky — a porteño curtain with a small sun at its centre.",
    architecture: "A Buenos Aires balcony canopy with fileteado curves and corrugated shade.",
    commentary: {
      file: "./audio/argentina-qf-alvarez-112.mp3",
      line: "Argentina — quarter-final drama vs Switzerland",
      clips: [
        {
          file: "./audio/argentina-opener-vs-switzerland.mp3",
          line: "Argentina find the breakthrough against Switzerland"
        },
        {
          file: "./audio/argentina-qf-alvarez-112.mp3",
          line: "The quality of a world champion — Julián Álvarez"
        },
        {
          file: "./audio/argentina-semi-final-clincher.mp3",
          line: "Argentina move into the final four"
        }
      ],
      sourceLabel: "FIFA full highlights · Argentina 3–1 Switzerland",
      sourceUrl: "https://www.youtube.com/watch?v=zZxxDbLxEi4",
      credit: "Official FIFA YouTube highlight"
    },
    sourceLabel: "AFA squad · Marcos Senesi replacement, 6 June 2026",
    sourceUrl: "https://www.fifa.com/es/tournaments/mens/worldcup/canadamexicousa2026/articles/leonardo-balerdi-baja-copa-mundial-argentina",
    players: [
      player("Emiliano Martínez", "Goalkeepers"), player("Gerónimo Rulli", "Goalkeepers"), player("Juan Musso", "Goalkeepers"),
      player("Nahuel Molina", "Defenders"), player("Gonzalo Montiel", "Defenders"), player("Cristian Romero", "Defenders"),
      player("Marcos Senesi", "Defenders"), player("Nicolás Otamendi", "Defenders"), player("Lisandro Martínez", "Defenders"),
      player("Nicolás Tagliafico", "Defenders"), player("Facundo Medina", "Defenders"),
      player("Leandro Paredes", "Midfielders"), player("Alexis Mac Allister", "Midfielders"), player("Rodrigo De Paul", "Midfielders"),
      player("Giovani Lo Celso", "Midfielders"), player("Exequiel Palacios", "Midfielders"), player("Enzo Fernández", "Midfielders"),
      player("Valentín Barco", "Midfielders"),
      player("Lionel Messi", "Forwards"), player("Julián Álvarez", "Forwards"), player("Lautaro Martínez", "Forwards"),
      player("Thiago Almada", "Forwards"), player("Nico Paz", "Forwards"), player("Nicolás González", "Forwards"),
      player("Giuliano Simeone", "Forwards"), player("José Manuel López", "Forwards")
    ]
  }
];
