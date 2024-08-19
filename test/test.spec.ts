import { expect } from 'chai'

describe('Test template', async function() {
  this.timeout(5000)
  it('tests the performance of Open AI embedding', async function() {
    const test = 'test'
    expect(test).to.be.a('string')
  })
})
