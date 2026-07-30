import { normalizeRecoUrl, parseRecoHtml, type RecoReconstruction } from '../src/integrations/reco'

export type RecoFetcher = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>

export async function importReco(
  inputUrl: string,
  fetcher: RecoFetcher = fetch
): Promise<RecoReconstruction> {
  const sourceUrl = normalizeRecoUrl(inputUrl)
  const response = await fetcher(sourceUrl, {
    headers: {
      Accept: 'text/html',
      'User-Agent': 'Smart Cube Coach/0.1 (+local study importer)'
    },
    redirect: 'follow'
  })

  if (!response.ok) {
    throw new Error(`reco.nz returned ${response.status}`)
  }

  return parseRecoHtml(await response.text(), sourceUrl)
}
