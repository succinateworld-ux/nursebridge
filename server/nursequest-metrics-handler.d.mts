import type {IncomingMessage,ServerResponse} from 'node:http'
export interface MetricsOptions {production?:boolean;origins?:string[];token?:string;databaseUrl?:string;file?:string}
export function createMetricsHandler(options?:MetricsOptions):(req:IncomingMessage & {body?:unknown},res:ServerResponse)=>Promise<void>
