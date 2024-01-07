import { describe } from 'mocha'
import chai from 'chai'
import assert, { expect } from 'chai'
import assertArrays from 'chai-arrays'
import * as fs from 'fs'

describe('Test template', function() {
  it('has a test folder', function() {
    const fileExists = fs.existsSync('./test')
    assert.expect(fileExists).be.true
  })
  
  it('tests an array', function() {
    chai.use(assertArrays)
    const strArr = ['the', 'dog', 'barked']
    expect(strArr).to.be.containingAllOf(['the', 'dog', 'barked'])
  })
})
