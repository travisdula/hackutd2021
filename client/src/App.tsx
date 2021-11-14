//import AppBar from '@material-ui/core/AppBar';
//import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
//import Toolbar from '@material-ui/core/Toolbar';
//import Typography from '@material-ui/core/Typography';

import React from 'react';
import { ClientResponse, processRequest, ServerRequest, ServerResponse } from './optimization';
import { AxisOptions, Chart } from 'react-charts'
import './index.css'

interface indexedValue {
    value: number
    index: number
}
interface Series {
    label: string
    data: indexedValue[]
}

function App() {

  const [request, setRequest] = React.useState<null | ServerRequest>(null);
  const [result, setResult] = React.useState<null | ServerResponse>(null);
  const [response, setResponse] = React.useState<null | ClientResponse>(null);

  const [resultHistory, setResultHistory] = React.useState<Array<ServerResponse>>([]);

  React.useEffect(() => {
    // const ws = new WebSocket('ws://localhost:9172');
    // eslint-disable-next-line no-restricted-globals
    const ws = new WebSocket(`wss://2021-utd-hackathon.azurewebsites.net`);

    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({setPitCapacity: 100000}));
    })

    // When the server sends new data, we send how to optimally allocate the water
    ws.addEventListener('message', (message) =>{

      if (message.data.startsWith('Error')) {
        window.alert(message.data);
        throw Error(message.data)
      }
      const data = JSON.parse(message.data);
      if (data.type === "CURRENT_STATE") {
        const request: ServerRequest = JSON.parse(message.data);
        setRequest(request);
        const response = processRequest(request)
        setResponse(response)
        ws.send(JSON.stringify(response));
      } else if (data.type === "OPTIMATION_RESULT") {
        const response: ServerResponse = JSON.parse(message.data);
        setResult(response);
        setResultHistory(r => r.concat(response));
      }
    });

    // Oh no! Something unexpected happened.
    ws.addEventListener('error', (event) => {
      throw Error(JSON.stringify(event));
    })

    // cleanup function
    return () => {
      ws.close();
    }
  }, [])
  
  //graph setup
  const zeroVal: indexedValue = {value: 0, index: 0} // makes it so the graph starts at 0
  const data: Series[] = [
    {
      label: "Incremental Revenue Graph",
      data: [zeroVal].concat(resultHistory.map(function(val: ServerResponse, idx: number): indexedValue {
        return {value: val.incrementalRevenue, index: idx + 1}
      }))
    }
  ]
  console.log(data[0].data)
  const primaryAxis = React.useMemo(
    (): AxisOptions<indexedValue> => ({
      getValue: datum => datum.index,
    }),
    []
  )
   const secondaryAxes = React.useMemo(
     (): AxisOptions<indexedValue>[] => [
       {
         getValue: datum => datum.value,
       },
     ],
     []
   )
  const utilizationPercent = (result?.flowRateToOperations ?? 0 )/ (result?.flowRateIn ?? 0) * 100
  const revenue = result?.revenuePerDay ?? 0
  const incRevenue = result?.incrementalRevenue ?? 0
  var formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  });
  return (
    <div className="bg-gradient-to-b from-blue-200 to-red-200 h-screen">
      <header>
        <h1 className="font-semibold text-xl text-center">
          EOG Well Realtime Monitoring
        </h1>
      </header>
      <body className="m-2">
        <h2>
          Incremental Revenue
        </h2>
        {
          (resultHistory.length > 1) ?
          (
            <div className="h-96">
              <Chart
                options={{
                  data,
                  primaryAxis,
                  secondaryAxes,
                }}
              />
            </div>
          )
          : <div> loading data... </div>
        }
        <br/>
        <div className="bg-opacity-50 bg-gray-400 rounded-lg">
          <div className="m-2">
            <h2 className="text-center text-lg font-semibold">
              Latest Result
            </h2>
            <div>
              <span> Type </span>
              <span> {result?.type} </span>
            </div>
            <h3 className="font-bold">
              Revenue
            </h3>
            <div className="">
              <div className="">
                <span>Incremental Revenue </span>
                <span className=""> {formatter.format(incRevenue)} </span>
              </div>
              <div className="">
                <span> Project Daily Revenue </span>
                <span> {formatter.format(revenue)} </span>
              </div>
            </div>
            <div>
              Flow Rate Utilization: {isNaN(utilizationPercent) ? "not defined" : `${utilizationPercent.toFixed(1)}%`}
            </div>
          </div>
        </div>
      </body>
    </div>
  );
}

export default App;
