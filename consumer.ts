import * as AWS from 'aws-sdk'
import { promises as fs } from 'fs'

/**
 * シーケンス番号の保存処理
 * @param {string} sequenceNumber - 保存するシーケンス番号
 */
const saveSequenceNumber = async (sequenceNumber: string) => {
  await fs.writeFile('./sequenceNumber.txt', sequenceNumber, 'utf8')
}

/**
 * シーケンス番号の取得処理
 */
const getSequenceNumber = async (): Promise<null | string> => {
  const sequenceNumber = await fs
    .readFile('./sequenceNumber.txt', 'utf8')
    .catch(() => null)
  return sequenceNumber
}

/**
 * Amazon Kinesis Data Streams から Contact Trace Record (CTR) を取得し続けるイテレータ
 * @param {string} params.streamName - Amazon Connect の CTR 出力先に指定された Amazon Kinesis Data Streams の名前
 * @param {number} params.waitTimeMS - Stream の最新のデータまで取得したあと、次のイテレーションを開始するまでの待機時間
 * @param {number} params.getRecordsLimit - イテレーション1回あたりに取得するレコードの最大数
 */
const ctrStreamIterator = async function* ({
  streamName,
  waitTimeMS,
  getRecordsLimit
}: {
  streamName: string
  waitTimeMS: number
  getRecordsLimit: number
}) {
  const kinesis = new AWS.Kinesis({
    apiVersion: '2013-12-02'
  })

  // ストリームのシャードを取得する
  const shards = await kinesis
    .listShards({
      MaxResults: 1,
      StreamName: streamName
    })
    .promise()

  if (!shards?.Shards?.[0].ShardId) {
    throw new Error('kinesis shard not found')
  }

  const seqNumber = await getSequenceNumber()
  let shdIter: string | undefined

  if (seqNumber) {
    // 保存されたシーケンス番号があった場合はそのシーケンス番号以降のデータを取得する
    const iter = await kinesis
      .getShardIterator({
        ShardId: shards.Shards[0].ShardId,
        ShardIteratorType: 'AFTER_SEQUENCE_NUMBER',
        StartingSequenceNumber: seqNumber,
        StreamName: streamName
      })
      .promise()
    shdIter = iter.ShardIterator
    console.log(
      `Iteration of "${streamName}" stream started with AFTER_SEQUENCE_NUMBER: ${seqNumber}`
    )
  } else {
    // 保存されたシーケンス番号がなかった場合は現時点以降のデータを取得する
    const iter = await kinesis
      .getShardIterator({
        ShardId: shards.Shards[0].ShardId,
        ShardIteratorType: 'LATEST',
        StreamName: streamName
      })
      .promise()
    shdIter = iter.ShardIterator
    console.log(`Iteration of "${streamName}" stream started with LATEST`)
  }

  if (!shdIter) {
    throw new Error('failed to get the kinesis shard iterator')
  }

  while (true) {
    const res: AWS.Kinesis.GetRecordsOutput = await kinesis
      .getRecords({
        ShardIterator: shdIter,
        Limit: getRecordsLimit
      })
      .promise()

    console.log(
      `${res.Records?.length} records retrieved from "${streamName}" stream. MillisBehindLatest: ${res.MillisBehindLatest}`
    )

    for (const rec of res.Records) {
      // JSON パースに失敗するとイテレーションが停止するため JSON パースの失敗は例外を投げない
      let data = null
      try {
        data = JSON.parse(rec.Data.toString())
      } catch (err) {
        console.error(err)
        console.error(rec.Data.toString())
      }

      if (data) {
        const ctr: ContactTraceRecord = data
        yield ctr
      }

      // シーケンス番号を保存する
      await saveSequenceNumber(rec.SequenceNumber)
    }

    shdIter = res.NextShardIterator

    // 何らかの理由で NextShardIterator が取得できなかった例外を投げて処理を止める
    if (typeof shdIter !== 'string' || !shdIter) {
      throw new Error('failed to get the next shard iterator')
    }

    // 最新まで追いついたら waitTimeMS 時間分待機してから次のイテレーションに進む
    if (res.MillisBehindLatest === 0) {
      await new Promise((cb) => setTimeout(cb, waitTimeMS))
    }
  }
}

const main = async () => {
  const params = {
    streamName: 'KINESIS_STREAM_NAME',
    waitTimeMS: 5000,
    getRecordsLimit: 1000
  }

  // Amazon Kinesis Data Streams に接続して CTR を取得し続ける
  for await (const ctr of ctrStreamIterator(params)) {
    console.log(ctr)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
