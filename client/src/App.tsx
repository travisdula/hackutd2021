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
  const data: Series[] = [
    {
      label: "Incremental Revenue",
      data: resultHistory.map(function(val: ServerResponse, idx: number): indexedValue {
        return {value: val.incrementalRevenue, index: idx}
      })
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

  return (
    <div>
      {false && <div className={""}>
        <div>1.) Server Sends Current State of the System:</div>
        <textarea rows={10} cols={150} value={JSON.stringify(request, undefined, 2)} />
        <div>2.) Client Sends Solution to the Optimization:</div>
        <textarea rows={10} cols={150} value={JSON.stringify(response, undefined, 2)}/>
        <div>3.) Server Sends Result:</div>
        <textarea rows={10} cols={150} value={JSON.stringify(result, undefined, 2)}/>
      </div>}
      {
        (resultHistory.length > 1) &&
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
      }
    </div>
  );
}

export default App;
