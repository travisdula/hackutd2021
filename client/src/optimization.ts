export interface Point {
  flowPerDay: number,
  dollarsPerDay: number,
}
interface WaterOperation {
  name: string,
  id: string,
  revenueStructure: Point[],
}

export interface ServerRequest {
  flowRateIn: number;
  operations: WaterOperation[];
  type: "CURRENT_STATE";
};

export interface ServerResponse {
  incrementalRevenue: number,
  revenuePerDay: number,
  flowRateIn: number,
  flowRateToOperations: number,
  type: "OPTIMATION_RESULT",
  currentPitVolume?: number ,
  maximumPitVolume?: number ,
}

export type ClientResponse = {
  operationId: string,
  flowRate: number,
}[];

/* 
 * Finds the dollarsPerDay at a specific point (currFlow) on the curve generated by linear 
 * interpolation from the points given on an operation's dollarsPerDay vs flowPerDay.
*/
function findCurrDollars(currFlow: number, points: Point[]) {
    var lowerIndex = 0; //index of largest point whose flowPerDay < currFlow
    var upperIndex = 0; //index of smallest point whose flowPerDay > currFlow
    for (var k = 0; k < points.length; k++) {
        if (currFlow === points[k].flowPerDay) {
            //No linear interpolation or calculations needed; currFlow and its corresponding dollarsPerDay are a provided data point
            return points[k].dollarsPerDay;
        }
        else if (currFlow > points[k].flowPerDay) {
            //Increment lowerIndex, since flowPerDay has not yet reached currFlow
            lowerIndex = k;
        }
        else {
            /*
             * Upper bound for linear interpolation found
             * Find slope of line for linear interpolation
             * Find height (dollars per day) at current point along interpolation and return
             */
            upperIndex = k;
            var slope = (points[upperIndex].dollarsPerDay - points[lowerIndex].dollarsPerDay) / (points[upperIndex].flowPerDay - points[lowerIndex].flowPerDay);
            return slope * (currFlow - points[lowerIndex].flowPerDay) + points[lowerIndex].dollarsPerDay;
        }
    }
    // if we've reached here, we are beyond what the data provided can handle
    return Number.NEGATIVE_INFINITY; // don't try to extrapolate
}
/*
 * Split the sum of the flow and the pit's contents into discrete, equal-sized chunks. For each chunk, check 
 * which operation would give the greatest return on investment if given that chunk, and allocate the chunk 
 * accordingly. If no operation gives a sufficient return on investment, attempt to allocate that chunk to the pit.
*/

var currPitVolume = 0;
var currPitVolumeList: number[] = [];
export function getCurrPitVolumeList() {
    return currPitVolumeList;
}

export function processRequest(request: ServerRequest): ClientResponse {
    // Make array mapping individual distributions to operations
    let distribution = new Array(request.operations.length);
    // Initialize to zero for safety
    for (let i = 0; i < distribution.length; i++) {
        distribution[i] = 0;
    }

    // Iterate repeatedly over operations, using a part of the remaining flow on the best option per iteration
    // If return on investment is in the nth percentile or lower, attempt to store it in a pit instead
    let remainingFlow = request.flowRateIn + currPitVolume;
    currPitVolume = 0;

    let flowChunks = remainingFlow / 1000;
    let bestIndex;
    let bestReturn;

    let avgReturn = Number.NEGATIVE_INFINITY;
    let numIterations = 0;

    while (remainingFlow > 0) {
        bestIndex = -1;
        bestReturn = Number.NEGATIVE_INFINITY;
        if (remainingFlow - flowChunks < 0) {
            flowChunks = remainingFlow;
        }
        for (let j = 0; j < request.operations.length; j++) {
            // Find potential gain from increasing flow to operation by looking at line between points
            // If potential gain is the best for this iteration, overwrite bestIndex
            let currFlow = distribution[j];
            let proposedFlow = currFlow + flowChunks;
            let currDollars = findCurrDollars(currFlow, request.operations[j].revenueStructure);
            let proposedDollars = findCurrDollars(proposedFlow, request.operations[j].revenueStructure);
            if (proposedDollars - currDollars > bestReturn) {
                bestReturn = proposedDollars - currDollars;
                bestIndex = j;
            }
        }
        numIterations++;
        if (avgReturn === Number.NEGATIVE_INFINITY) {
            // Initial set
            avgReturn = bestReturn;
        } else {
            avgReturn = (avgReturn * (numIterations - 1) + bestReturn) / numIterations;
        }

        // check if potential gain is above storage threshold
        //  if so, allocate flow
        //  otherwise, attempt to store - if this fails, allocate flow
        if (bestReturn >= (avgReturn/4-2000) * (10 * currPitVolume / 35000)) {
            distribution[bestIndex] += flowChunks;
            remainingFlow -= flowChunks;
        } else {
            if (35000 - currPitVolume < flowChunks) {
                flowChunks -= (35000 - currPitVolume);
                currPitVolume = 35000; // simplified math

                distribution[bestIndex] += flowChunks;
                remainingFlow -= flowChunks;
            } else {
                currPitVolume += flowChunks;
                remainingFlow -= flowChunks;
            }
        }
    }
    for (let entry of distribution) { // By all means, this code should not do anything. It seems to fix a fatal error without ever running though.
        if (entry === 0) {
            entry = 0;
        }
    }
    currPitVolumeList.push(currPitVolume);
    return request.operations.map((operation, index) => {
        return {
            operationId: operation.id,
            flowRate: distribution[index],
        }
    })
}