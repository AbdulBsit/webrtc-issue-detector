/* eslint-disable class-methods-use-this */
import {
  CompositeStatsParser, ConnectionInfo, StatsParser, StatsReportItem,
} from '../types';
import { checkIsConnectionClosed } from './utils';

export interface AddConnectionPayload {
  id: string;
  pc: RTCPeerConnection;
}

export interface RemoveConnectionPayload {
  id:string
}

interface CompositeRTCStatsParserParams {
  statsParser: StatsParser;
}

class CompositeRTCStatsParser implements CompositeStatsParser {
  private connections: Record<string,ConnectionInfo> = {}

  private readonly statsParser: StatsParser;

  constructor(params: CompositeRTCStatsParserParams) {
    this.statsParser = params.statsParser;
  }

  listConnections(): ConnectionInfo[] {
    return Object.keys(this.connections).map((id)=>this.connections[id])
  }

  addPeerConnection(payload: AddConnectionPayload): void {
    this.connections[payload.id] = {
        id: payload.id ?? String(Date.now() + Math.random().toString(32)),
        pc: payload.pc,
    };
  }

  removePeerConnection(payload: RemoveConnectionPayload): void {
    delete this.connections[payload.id]
  }

  removeAllPeerConnection(): void {
    this.connections = {}
  }

  async parse(): Promise<StatsReportItem[]> {
    // DESC order to remove elements afterwards without index shifting
    const closedConnectionsIds: string[] = []

    const statsPromises = Object.keys(this.connections).map(
      async (
        id
      ): Promise<StatsReportItem | undefined> => {
        const info = this.connections[id]
        if (checkIsConnectionClosed(info.pc)) {
          closedConnectionsIds.push(info.id)
          return undefined;
        }

        return this.statsParser.parse(info);
      },
    );

    if (closedConnectionsIds.length) {
        closedConnectionsIds.forEach((id)=>{
          delete this.connections[id]
        })
    }

    const statsItemsByPC = await Promise.all(statsPromises);

    return statsItemsByPC.filter((item) => item !== undefined) as StatsReportItem[];
  }

}

export default CompositeRTCStatsParser;
