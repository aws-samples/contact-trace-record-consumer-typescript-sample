/**
 * Contact Trace Record (CTR) の型定義
 * この型情報はサンプルです。必要に応じて適宜変更してください。
 */
interface ContactTraceRecord {
  AWSAccountId: string
  AWSContactTraceRecordFormatVersion: string
  Agent: Agent
  AgentConnectionAttempts: number
  Channel: string
  ConnectedToSystemTimestamp: string
  ContactId: string
  DisconnectReason: string
  DisconnectTimestamp: string
  InitiationMethod: string
  InitiationTimestamp: string
  InstanceARN: string
  LastUpdateTimestamp: string
  Queue: Queue
}

interface Agent {
  ARN: string
  AfterContactWorkDuration: number
  AfterContactWorkEndTimestamp: string
  AfterContactWorkStartTimestamp: string
  AgentInteractionDuration: number
  ConnectedToAgentTimestamp: string
  CustomerHoldDuration: number
  LongestHoldDuration: number
  NumberOfHolds: number
  Username: string
}

interface Queue {
  ARN: string
  DequeueTimestamp: string
  Duration: number
  EnqueueTimestamp: string
  Name: string
}
