'use client'

import { serverApi } from '@forgeboard/api-client/server'

export default function InvalidClientImportFixture() {
  return <p>{typeof serverApi}</p>
}
