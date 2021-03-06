import test from 'ava'
import _ from 'highland'
import sinon from 'sinon'

import {
  devalpha,
  ORDER_PLACED,
  ORDER_FILLED,
  ORDER_FAILED,
  ORDER_CANCELLED,
  INITIALIZED,
  FINISHED
} from '../dist'
import createMockClient from './util/createMockClient'

test.beforeEach((t) => {
  t.context.error = console.error
  console.error = sinon.spy()
})

test.afterEach((t) => {
  console.error = t.context.error
})

test.serial.cb('backtest event order', t => {
  const executions = []
  const strategy = ({ order }, action) => {
    switch (action.type) {
    case 'example':
      executions.push('a')
      order({
        identifier: 'GOOG',
        price: 100,
        quantity: 50
      })
      executions.push('b')
      order({
        identifier: 'MSFT',
        price: 100,
        quantity: 30
      })
      executions.push('c')
      break
    case ORDER_PLACED:
      executions.push('d')
      break
    case ORDER_FILLED:
      executions.push('e')
      break
    default:
      break
    }
  }

  devalpha({
    feeds: {
      example: [
        {
          value: 'event 1',
          timestamp: 100
        },
        {
          value: 'event 2',
          timestamp: 200
        }
      ]
    },
    initialStates: {
      capital: {
        cash: 9999999
      }
    }
  }, strategy)
    .resume()

  setTimeout(() => {
    const expected = 'abcdedeabcdede'
    const actual = executions.join('')
    t.is(actual, expected)
    t.end()
  }, 100)

})

test.serial.cb('live trading event order', t => {

  const executions = []
  const strategy = ({ order }, action) => {
    switch (action.type) {
    case 'example':
      executions.push('a')
      order({
        identifier: 'GOOG',
        price: 100,
        quantity: 50
      })
      executions.push('b')
      order({
        identifier: 'MSFT',
        price: 100,
        quantity: 50
      })
      executions.push('c')
      break
    case ORDER_PLACED:
      executions.push('d')
      break
    case ORDER_FILLED:
      executions.push('e')
      break
    default:
      break
    }
  }

  devalpha({
    feeds: {
      example: _((push, next) => {
        setTimeout(() => {
          push(null, { value: 'event 1', timestamp: 100 })
        }, 0)
        setTimeout(() => {
          push(null, { value: 'event 2', timestamp: 101 })
        }, 0)
      })
    },
    initialStates: {
      capital: {
        cash: 9999999
      }
    },
    client: createMockClient(),
    backtesting: false
  }, strategy).resume()

  setTimeout(() => {
    const expected = 'abcabcddddeeee'
    const actual = executions.join('')
    t.is(actual, expected)
    t.end()
  }, 1000)

})

test.serial.cb('state() returns an object', t => {

  const strategy = ({ state }, action) => {
    t.is(typeof (state()), 'object')
    t.end()
  }

  devalpha({
    backtesting: false
  }, strategy).resume()
})

test.serial.cb('failing orders are dispatched', t => {
  const strategy = ({ order }, action) => {
    switch (action.type) {
    case 'example':
      order({
        identifier: 'GOOG',
        price: 100,
        quantity: 50
      })
      break
    case ORDER_FAILED:
      t.end()
      break
    default:
      break
    }
  }

  devalpha({
    feeds: {
      example: _((push, next) => {
        setTimeout(() => {
          push(null, { value: 'event 1', timestamp: 100 })
        }, 0)
      })
    },
    initialStates: {
      capital: {
        cash: 9999999
      }
    },
    client: createMockClient(true),
    backtesting: false
  }, strategy).resume()

})

test.serial.cb('orders are cancellable', t => {
  const strategy = ({ order, cancel, state }, action) => {
    switch (action.type) {
    case 'example':
      order({
        identifier: 'GOOG',
        price: 100,
        quantity: 50
      })
      break
    case ORDER_PLACED:
      cancel('1')
      break
    case ORDER_CANCELLED:
      const actual = state().orders
      const expected = {}
      t.deepEqual(actual, expected)
      t.end()
      break
    default:
      break
    }
  }

  devalpha({
    feeds: {
      example: _((push, next) => {
        setTimeout(() => {
          push(null, { value: 'event 1', timestamp: 100 })
        }, 0)
      })
    },
    initialStates: {
      capital: {
        cash: 9999999
      }
    },
    client: createMockClient(),
    backtesting: false
  }, strategy).resume()

})

test.serial.cb('should not be able to cancel unknown orders', t => {
  const strategy = ({ cancel }, action) => {
    switch (action.type) {
    case 'example':
      cancel('1')
      break
    case ORDER_FAILED:
      t.end()
      break
    default:
      break
    }
  }

  devalpha({
    feeds: {
      example: _((push, next) => {
        setTimeout(() => {
          push(null, { value: 'event 1', timestamp: 100 })
        }, 0)
      })
    },
    client: createMockClient(true),
    backtesting: false
  }, strategy).resume()

})

/*
test.serial.cb('correctly preloads stored state', (t) => {

  devalpha({
    feeds: {
      example: _((push, next) => {
        setTimeout(() => {
          push(null, { value: 'event 1', timestamp: 100 })
        }, 0)
        setTimeout(() => {
          push(null, { value: 'event 1', timestamp: 101 })
        }, 1)
      })
    },
    initialStates: {
      capital: {
        cash: 999
      }
    },
    client: createMockClient(),
    strategy: () => {},
    journal: t.context.journal,
    backtesting: false
  })

  setTimeout(() => {
    devalpha({
      feeds: {
        example: _((push, next) => {
          setTimeout(() => {
            push(null, { value: 'event 1', timestamp: 503 })
          }, 0)
        })
      },
      client: createMockClient(),
      strategy: ({ state }) => {
        const actual = state().capital.cash
        const expected = 999

        fs.unlinkSync(t.context.journal)

        t.is(actual, expected)
        t.end()
      },
      journal: t.context.journal,
      backtesting: false
    })
  }, 500)

})
*/

// test.serial.cb('logs errors on skipped events during live trading', (t) => {
//   devalpha({
//     feeds: {
//       example: _((push, next) => {
//         setTimeout(() => {
//           push(null, { value: 'event 1' })
//         }, 0)
//       })
//     },
//     client: createMockClient(),
//     strategy: () => {},
//     resume: true,
//     backtesting: false,
//     onError: (err) => {
//       const actual = err.message
//       const expect = 'Skipped event from feed example due to missing timestamp property.'

//       t.is(actual, expect)
//       t.end()
//     }
//   })
// })

// test.serial.cb('logs errors on skipped events during backtests', (t) => {

//   devalpha({
//     feeds: {
//       example: [{ value: 'event 1' }]
//     },
//     client: createMockClient(),
//     strategy: () => {},
//     resume: true,
//     onError: (err) => {
//       const actual = err.message
//       const expect = 'Skipped event from feed example due to missing timestamp property.'

//       t.is(actual, expect)
//       t.end()
//     }
//   })

// })

test('throws if strategy is not a function', (t) => {
  t.throws(() => devalpha({
    strategy: 'foobar'
  }).resume())
})

test.serial.cb('stream returns items containing action and state during live trading', (t) => {
  const events = []
  const strat = devalpha({
    feeds: {},
    backtesting: false
  }, () => {})

  strat.each(({ state, action }) => {
    t.is(typeof state.capital, 'object')
    t.is(typeof state.orders, 'object')
    t.is(typeof state.positions, 'object')
    t.is(typeof state.timestamp, 'number')
    events.push(action.type)
  }).done(() => {
    t.deepEqual(events, [INITIALIZED, FINISHED])
    t.end()
  })
})

test.serial.cb('stream returns items containing action and state during backtests', (t) => {
  const events = []
  const strat = devalpha({
    feeds: {}
  }, () => {})

  strat.each(({ state, action }) => {
    t.is(typeof state.capital, 'object')
    t.is(typeof state.orders, 'object')
    t.is(typeof state.positions, 'object')
    t.is(typeof state.timestamp, 'number')
    events.push(action.type)
  }).done(() => {
    t.deepEqual(events, [INITIALIZED, FINISHED])
    t.end()
  })
})

test.serial.cb('errors can be extracted from the stream', (t) => {
  const strat = devalpha({
    feeds: {
      events: [{ timestamp: 0 }]
    }
  }, () => {
    throw new Error('strat')
  })

  strat.errors((err) => {
    t.is(err.message, 'strat')
  }).done(() => {
    t.end()
  })
})

test.serial.cb('errors can be extracted from merged streams', (t) => {
  const strat1 = devalpha({
    feeds: {
      events: [{ timestamp: 0 }]
    }
  }, () => { throw new Error('strat1') })

  const strat2 = devalpha({
    feeds: {
      events: [{ timestamp: 0 }]
    }
  }, () => { throw new Error('strat2') })

  const errors = []
  _.merge([strat1, strat2]).errors((err) => {
    errors.push(err)
  }).done(() => {
    t.is(errors[0].message, 'strat1')
    t.is(errors[1].message, 'strat2')
    t.end()
  })
})

test.serial.cb('stream consumers recieve all events in the right order', (t) => {
  const events = []
  const strat = devalpha({
    feeds: {
      events: [{ timestamp: 0 }, { timestamp: 1 }]
    }
  }, (context, action) => {
    events.push('a')
  })

  strat.each(() => {
    events.push('b')
  }).done(() => {
    t.deepEqual(events.join(''), 'abababab')
    t.end()
  })
})

test.serial.cb('stream consumers can apply backpressure', (t) => {
  const events = []
  const strat = devalpha({
    feeds: {
      events: [{ timestamp: 0 }, { timestamp: 1 }]
    }
  }, () => {
    events.push('a')
  })

  const fork1 = strat.fork().map((item) => {
    // eslint-disable-next-line no-empty
    for (let i = 0; i < 5000000; i += 1) {}
    events.push('b')
    return item
  })

  const fork2 = strat.fork().map((item) => {
    // eslint-disable-next-line no-empty
    for (let i = 0; i < 100; i += 1) {}
    events.push('c')
    return item
  })

  strat.fork().done(() => {
    t.deepEqual(events.join(''), 'abcabcabcabc')
    t.end()
  })

  fork1.resume()
  fork2.resume()
})
