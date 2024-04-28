import ImageService from '@rebel/server/services/ImageService'
import WebService from '@rebel/server/services/WebService'
import { Dependencies } from '@rebel/shared/context/context'
import { cast, nameof, promised } from '@rebel/shared/testUtils'
import { MockProxy, mock } from 'jest-mock-extended'

let mockWebService: MockProxy<WebService>
let imageService: ImageService

beforeEach(() => {
  mockWebService = mock()

  imageService = new ImageService(new Dependencies({
    webService: mockWebService,
    logService: mock()
  }))
})

describe(nameof(ImageService, 'convertToPng'), () => {
  test('Converts the svg to a png file', async () => {
    const svg = '<svg height="10" width="10" xmlns="http://www.w3.org/2000/svg"><circle r="4" cx="5" cy="5" fill="red" /></svg>'
    const imageUrl = 'url'
    mockWebService.fetch.calledWith(imageUrl).mockResolvedValue(cast<Response>({ arrayBuffer: () => promised(Buffer.from(svg, 'utf-8')), headers: mock() }))

    const result = await imageService.convertToPng(imageUrl)

    expect(result).toBe('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAWklEQVR4nJXPQQqAMAxE0X8QXffsLQUvpqJeYCSQRagt1MCs8iAT+DuCVVAFj2cTpB46BGpy2i7C2kHylAjt1Ajes/CK0IqPYI4wefEW7YKl93mxTp78QTPzApadbTun7hITAAAAAElFTkSuQmCC')
  })
})

describe(nameof(ImageService, 'getImageDimensions'), () => {
  test('Correctly gets the image dimensions of a base64 png', () => {
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAWklEQVR4nJXPQQqAMAxE0X8QXffsLQUvpqJeYCSQRagt1MCs8iAT+DuCVVAFj2cTpB46BGpy2i7C2kHylAjt1Ajes/CK0IqPYI4wefEW7YKl93mxTp78QTPzApadbTun7hITAAAAAElFTkSuQmCC'

    const result = imageService.getImageDimensions(png)

    expect(result).toEqual<typeof result>({ width: 10, height: 10 })
  })
})
