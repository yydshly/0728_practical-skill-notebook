import { isDeepStrictEqual } from 'node:util'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

type Contract = {
  assetId: string
  kind: string
  units: string
  upAxis: string
  forwardAxis: string
  origin: string
  lods: Array<{ level: number; maxDistance: number; maxTriangles: number }>
  textureBudget: { maxDimension: number; maxTextureCount: number }
  materialBudget: { maxMaterials: number }
  requiredCollections: string[]
  requiredNodes: string[]
  requiredAnimations: string[]
  requiredAnimationEvents: Record<string, string[]>
  creationRoute: string
  placementLandmarks?: {
    space: string
    upAxis: string
    forwardAxis: string
    groundCenter: [number, number, number]
    mainThresholdCenter: [number, number, number]
    entrySocket: [number, number, number]
    yardSocket: [number, number, number]
  }
}

type ApprovedContract = Omit<Contract, 'lods'> & {
  lods: Array<Contract['lods'][number] & { minDistance: number }>
}

type ApprovedBaseline = {
  baselineId: string
  authority: string
  generatedFromBriefOrContract: false
  assets: Record<string, ApprovedContract>
}

const contractKeys = [
  'assetId',
  'kind',
  'units',
  'upAxis',
  'forwardAxis',
  'origin',
  'lods',
  'textureBudget',
  'materialBudget',
  'requiredCollections',
  'requiredNodes',
  'requiredAnimations',
  'requiredAnimationEvents',
  'creationRoute',
] as const

const assetSlugs = [
  'electric-tricycle-a',
  'farmer-a',
  'peach-tree-a',
  'farmhouse-a',
] as const

function parseAuthoritativeContract(brief: string): Contract {
  const start = '<!-- asset-contract:start -->'
  const end = '<!-- asset-contract:end -->'

  if (brief.split(start).length !== 2 || brief.split(end).length !== 2) {
    throw new Error('brief must contain exactly one authoritative contract block')
  }

  const block = brief.split(start)[1]?.split(end)[0]?.trim() ?? ''
  const match = block.match(/^```json\r?\n([\s\S]+)\r?\n```$/)
  if (!match?.[1]) {
    throw new Error('authoritative contract block must be one strict JSON fence')
  }

  const parsed = JSON.parse(match[1]) as Contract
  const actualKeys = Object.keys(parsed).sort()
  const expectedKeys = [
    ...contractKeys,
    ...(parsed.placementLandmarks ? ['placementLandmarks'] : []),
  ].sort()
  if (!isDeepStrictEqual(actualKeys, expectedKeys)) {
    throw new Error('authoritative contract has missing or extra fields')
  }
  return parsed
}

function assertUnique(values: string[], field: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`${field} contains duplicate values`)
  }
}

function assertBriefMatchesContract(brief: string, contract: Contract): Contract {
  const parsed = parseAuthoritativeContract(brief)
  if (!isDeepStrictEqual(parsed, contract)) {
    throw new Error('authoritative contract does not exactly match contract JSON')
  }

  assertUnique(parsed.requiredCollections, 'requiredCollections')
  assertUnique(parsed.requiredNodes, 'requiredNodes')
  assertUnique(parsed.requiredAnimations, 'requiredAnimations')
  for (const [clip, events] of Object.entries(parsed.requiredAnimationEvents)) {
    if (!parsed.requiredAnimations.includes(clip)) {
      throw new Error(`animation events reference unrequired clip: ${clip}`)
    }
    assertUnique(events, `requiredAnimationEvents.${clip}`)
  }
  return parsed
}

async function loadContract(slug: string): Promise<Contract> {
  return JSON.parse(await readFile(
    resolve(`docs/assets/contracts/${slug}.json`),
    'utf8',
  )) as Contract
}

async function loadBrief(slug: string): Promise<string> {
  return readFile(resolve(`docs/assets/briefs/${slug}.md`), 'utf8')
}

async function loadApprovedBaseline(): Promise<ApprovedBaseline> {
  const baseline = JSON.parse(await readFile(resolve(
    'tests/fixtures/asset-brief-contracts/approved-baseline.json',
  ), 'utf8')) as ApprovedBaseline
  if (
    baseline.baselineId !== 'task-5-approved-asset-facts-v1'
    || baseline.authority !== 'Task 5 brief plus independent review approval'
    || baseline.generatedFromBriefOrContract !== false
  ) {
    throw new Error('approved baseline provenance metadata is invalid')
  }
  return baseline
}

function stripAuthoritativeContract(brief: string): string {
  const start = '<!-- asset-contract:start -->'
  const end = '<!-- asset-contract:end -->'
  const startIndex = brief.indexOf(start)
  const endIndex = brief.indexOf(end, startIndex + start.length)
  return [
    brief.slice(0, startIndex),
    brief.slice(endIndex + end.length),
  ].join('')
}

function assertNoReservedSourceOriginTermInProse(brief: string): void {
  const prose = stripAuthoritativeContract(brief)
  if (/\bsource origin\b/i.test(prose)) {
    throw new Error('brief prose contains reserved term: source origin')
  }
}

function projectApprovedFacts(contract: Contract): ApprovedContract {
  const lods = contract.lods.map((lod, index) => {
    const minDistance = index === 0
      ? 0
      : contract.lods[index - 1]!.maxDistance
    if (lod.maxDistance <= minDistance) {
      throw new Error('contract LOD distances must be strictly increasing')
    }
    return { ...lod, minDistance }
  })
  return { ...contract, lods }
}

function assertApprovedLodBoundaries(approved: ApprovedContract): void {
  approved.lods.forEach((lod, index) => {
    const expectedMinDistance = index === 0
      ? 0
      : approved.lods[index - 1]!.maxDistance
    if (lod.minDistance !== expectedMinDistance) {
      throw new Error('approved baseline LOD boundaries must be continuous')
    }
    if (lod.maxDistance <= lod.minDistance) {
      throw new Error('approved baseline LOD distances must be increasing')
    }
  })
}

function assertApprovedAsset(
  brief: string,
  contract: Contract,
  approved: ApprovedContract,
): Contract {
  const parsed = assertBriefMatchesContract(brief, contract)
  assertNoReservedSourceOriginTermInProse(brief)
  assertApprovedLodBoundaries(approved)
  if (!isDeepStrictEqual(projectApprovedFacts(parsed), approved)) {
    throw new Error('contract does not match independent approved baseline')
  }
  return parsed
}

describe('asset briefs and Blender contracts', () => {
  for (const slug of assetSlugs) {
    it(`${slug} matches its JSON and independent approved baseline`, async () => {
      const [brief, contract, baseline] = await Promise.all([
        loadBrief(slug),
        loadContract(slug),
        loadApprovedBaseline(),
      ])
      const approved = baseline.assets[slug]
      if (!approved) {
        throw new Error(`approved baseline missing asset: ${slug}`)
      }
      assertApprovedAsset(brief, contract, approved)
    })
  }

  it('rejects synchronized tricycle triangle-budget drift', async () => {
    const [brief, contract, baseline] = await Promise.all([
      loadBrief('electric-tricycle-a'),
      loadContract('electric-tricycle-a'),
      loadApprovedBaseline(),
    ])
    const approved = baseline.assets['electric-tricycle-a']
    if (!approved) {
      throw new Error('approved baseline missing electric-tricycle-a')
    }
    const changedBrief = brief.replace(
      '"maxTriangles": 60000',
      '"maxTriangles": 1',
    )
    const changedContract = structuredClone(contract)
    changedContract.lods[0]!.maxTriangles = 1

    expect(() => assertApprovedAsset(
      changedBrief,
      changedContract,
      approved,
    )).toThrow('contract does not match independent approved baseline')
  })

  it('rejects a synchronized tricycle driver-seat rename', async () => {
    const [brief, contract, baseline] = await Promise.all([
      loadBrief('electric-tricycle-a'),
      loadContract('electric-tricycle-a'),
      loadApprovedBaseline(),
    ])
    const approved = baseline.assets['electric-tricycle-a']
    if (!approved) {
      throw new Error('approved baseline missing electric-tricycle-a')
    }
    const changedBrief = brief.replace('"driver_seat"', '"driver_seat_wrong"')
    const changedContract = structuredClone(contract)
    changedContract.requiredNodes[0] = 'driver_seat_wrong'

    expect(() => assertApprovedAsset(
      changedBrief,
      changedContract,
      approved,
    )).toThrow('contract does not match independent approved baseline')
  })

  it('rejects the reserved source-origin term in dimensions prose', async () => {
    const [brief, contract, baseline] = await Promise.all([
      loadBrief('farmhouse-a'),
      loadContract('farmhouse-a'),
      loadApprovedBaseline(),
    ])
    const approved = baseline.assets['farmhouse-a']
    if (!approved) {
      throw new Error('approved baseline missing farmhouse-a')
    }
    const changedBrief = brief.replace(
      '## Dimensions and spatial proportions',
      [
        '## Dimensions and spatial proportions',
        '',
        'Place the source origin at the center of the main entry threshold.',
      ].join('\n'),
    )

    expect(() => assertApprovedAsset(
      changedBrief,
      contract,
      approved,
    )).toThrow('brief prose contains reserved term: source origin')
  })

  it.each([
    {
      description: 'declarative is sentence in the dimensions section',
      sentence: 'The source origin is at the center of the main entry threshold.',
      mutate: (brief: string, sentence: string) => brief.replace(
        '## Dimensions and spatial proportions',
        `## Dimensions and spatial proportions\n\n${sentence}`,
      ),
    },
    {
      description: 'use-as sentence in the intent section',
      sentence: 'Use the center of the main entry threshold as the source origin.',
      mutate: (brief: string, sentence: string) => brief.replace(
        '## Intent and recognition',
        `## Intent and recognition\n\n${sentence}`,
      ),
    },
    {
      description: 'shall-be sentence at the end of the brief',
      sentence: 'The source origin shall be the center of the main entry threshold.',
      mutate: (brief: string, sentence: string) => `${brief}\n${sentence}\n`,
    },
  ])('rejects reserved source-origin prose: $description', async ({
    sentence,
    mutate,
  }) => {
    const [brief, contract, baseline] = await Promise.all([
      loadBrief('farmhouse-a'),
      loadContract('farmhouse-a'),
      loadApprovedBaseline(),
    ])
    const approved = baseline.assets['farmhouse-a']
    if (!approved) {
      throw new Error('approved baseline missing farmhouse-a')
    }

    expect(() => assertApprovedAsset(
      mutate(brief, sentence),
      contract,
      approved,
    )).toThrow('brief prose contains reserved term: source origin')
  })

  it('allows prose that references structured origin fields', async () => {
    const [brief, contract, baseline] = await Promise.all([
      loadBrief('farmhouse-a'),
      loadContract('farmhouse-a'),
      loadApprovedBaseline(),
    ])
    const approved = baseline.assets['farmhouse-a']
    if (!approved) {
      throw new Error('approved baseline missing farmhouse-a')
    }
    const changedBrief = brief.replace(
      '## Dimensions and spatial proportions',
      [
        '## Dimensions and spatial proportions',
        '',
        'Use structured `origin` and `placementLandmarks` for placement.',
      ].join('\n'),
    )

    expect(() => assertApprovedAsset(
      changedBrief,
      contract,
      approved,
    )).not.toThrow()
  })

  it('rejects a brief whose authoritative origin conflicts with contract JSON', async () => {
    const brief = await readFile(resolve(
      'tests/fixtures/asset-brief-contracts/conflicting-origin.md',
    ), 'utf8')
    const contract = await loadContract('farmhouse-a')

    expect(() => assertBriefMatchesContract(brief, contract))
      .toThrow('authoritative contract does not exactly match contract JSON')
  })

  it('rejects a required name found only in non-authoritative prose', async () => {
    const brief = await readFile(resolve(
      'tests/fixtures/asset-brief-contracts/name-only-in-body.md',
    ), 'utf8')
    const contract = await loadContract('farmhouse-a')

    expect(brief).toContain('`entry_socket`')
    expect(() => assertBriefMatchesContract(brief, contract))
      .toThrow('authoritative contract does not exactly match contract JSON')
  })
})

describe('reference board audit table', () => {
  it('records 16 rows across 12 verified source URLs with exact usage', async () => {
    const board = await readFile(
      resolve('docs/assets/reference-board/README.md'),
      'utf8',
    )
    const rows = board.split(/\r?\n/)
      .filter(line => line.startsWith('| linked/'))
      .map((line) => {
        const cells = line.split('|').slice(1, -1).map(cell => cell.trim())
        if (cells.length !== 5 || cells.some(cell => cell.length === 0)) {
          throw new Error(`malformed reference-board row: ${line}`)
        }
        const [file, subject, url, publisher, usage] = cells as [
          string,
          string,
          string,
          string,
          string,
        ]
        return {
          file,
          subject,
          url,
          publisher,
          usage,
        }
      })

    expect(rows).toHaveLength(16)
    expect(new Set(rows.map(row => row.url)).size).toBe(12)
    expect(rows.every(row => row.usage === 'shape-reference-only')).toBe(true)
    expect(rows.filter(row => row.url.includes('xlmotos.com')))
      .toHaveLength(5)
    expect(rows.filter(row => row.url.includes('xlmotos.com'))
      .every(row => row.publisher
        === 'Jiangsu Xinling Motorcycle Fabricate Co., Ltd. (XINLING)'))
      .toBe(true)
    expect(rows).toContainEqual(expect.objectContaining({
      file: 'linked/china-modern-plastic-peach-crates',
      url: 'https://www.linyi.gov.cn/info/9316/451179.htm',
      publisher: '临沂日报 / 临沂市人民政府',
      usage: 'shape-reference-only',
    }))
  })
})
