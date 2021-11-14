
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

function findCurrDollars(currFlow: number, points: Point[]) {
    var lowerIndex = 0;
    var upperIndex = 0;
    for (var k = 0; k < points.length; k++) {
        if (currFlow === points[k].flowPerDay) {
            //exact match
            return points[k].dollarsPerDay;
        }
        else if (currFlow > points[k].flowPerDay) {
            lowerIndex = k;
            upperIndex = k;
        }
        else {
            upperIndex = k;
            // calculate dollarsPerDay on line between points[lowerIndex] and points[upperIndex]
            var slope = (points[upperIndex].dollarsPerDay - points[lowerIndex].dollarsPerDay) / (points[upperIndex].flowPerDay - points[lowerIndex].flowPerDay);
            return slope * (currFlow - points[lowerIndex].flowPerDay) + points[lowerIndex].dollarsPerDay;
        }
    }
    // if we've reached here, we are beyond what the data provided can handle
    return Number.NEGATIVE_INFINITY; // don't try to extrapolate
}

// You should do better!
export function processRequest(request: ServerRequest): ClientResponse {
    // Make array mapping individual distributions to operations
    var distribution = new Array(request.operations.length);
    // Initialize to zero for safety
    for (var i = 0; i < distribution.length; i++) {
        distribution[i] = 0;
    }

    // Iterate repeatedly over operations, using a part of the remaining flow on the best option per iteration
    // If return on investment is in the nth percentile or lower, attempt to store it in a pit instead
    var remainingFlow = request.flowRateIn;
    var flowChunks = remainingFlow / 10000;
    var bestIndex;
    var bestReturn;
    while (remainingFlow > 0) {
        bestIndex = -1;
        bestReturn = Number.NEGATIVE_INFINITY;
        if (remainingFlow - flowChunks < 0) {
            flowChunks = remainingFlow;
        }
        for (var j = 0; j < request.operations.length; j++) {
            // Find potential gain from increasing flow to operation by looking at line between points
            // If potential gain is the best for this iteration, overwrite bestIndex
            var currFlow = distribution[j];
            var proposedFlow = currFlow + flowChunks;
            var currDollars = findCurrDollars(currFlow, request.operations[j].revenueStructure);
            var proposedDollars = findCurrDollars(proposedFlow, request.operations[j].revenueStructure);
            if (proposedDollars - currDollars > bestReturn) {
                bestReturn = proposedDollars - currDollars;
                bestIndex = j;
            }
        }
        // check if potential gain is above storage threshold
        //  if so, allocate flow
        //  otherwise, attempt to store - if this fails, allocate flow
        distribution[bestIndex] += flowChunks;
        remainingFlow -= flowChunks;
    }

    return request.operations.map((operation, index) => {
        return {
            operationId: operation.id,
            flowRate: distribution[index],
        }
    })
}