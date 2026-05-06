import {
  enqueueMlJob,
  waitForMlJobCompletion,
} from './mlJobsApi';

const isPlainObject = (value) => {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const invokeQueued = async (service, method, args = [], metadata = {}) => {
  const job = await enqueueMlJob({ service, method, args, metadata });
  const completed = await waitForMlJobCompletion(job.id);
  return completed.result;
};

const createRemoteProxy = (remoteValue) => {
  const ref = remoteValue.__remoteRef;
  const snapshot = remoteValue.__snapshot || {};

  const base = {
    __remoteRef: ref,
    ...snapshot,
  };

  return new Proxy(base, {
    get(target, property) {
      if (property in target) {
        return target[property];
      }

      if (typeof property === 'string') {
        return async (...args) => {
          const raw = await invokeQueued('__remote__', 'invoke', [
            { __remoteRef: ref },
            property,
            args,
          ], {
            queueLabel: `Remote ${property}`,
          });
          return hydrateResult(raw);
        };
      }

      return undefined;
    },
  });
};

const hydrateResult = (value) => {
  if (value == null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(hydrateResult);
  }

  if (value.__remoteRef) {
    return createRemoteProxy(value);
  }

  if (isPlainObject(value)) {
    const output = {};
    Object.entries(value).forEach(([key, nested]) => {
      output[key] = hydrateResult(nested);
    });
    return output;
  }

  return value;
};

const run = async (service, method, args = [], metadata = {}) => {
  const raw = await invokeQueued(service, method, args, metadata);
  return hydrateResult(raw);
};

export const trainRandomForest = (...args) => run('randomForestService', 'trainRandomForest', args, { algorithm: 'randomForest' });
export const prepareLatestRandomForestFeatures = (...args) => run('randomForestService', 'prepareLatestRandomForestFeatures', args, { algorithm: 'randomForest' });

export const trainAndEvaluate = (...args) => run('mlService', 'trainAndEvaluate', args, { algorithm: 'naiveBayes' });
export const prepareLatestForPrediction = (...args) => run('mlService', 'prepareLatestForPrediction', args, { algorithm: 'naiveBayes' });
export const discretizePredictionSample = (...args) => run('mlService', 'discretizePredictionSample', args, { algorithm: 'naiveBayes' });
export const getMarketTimeInfo = (...args) => run('mlService', 'getMarketTimeInfo', args, { algorithm: 'naiveBayes' });
export const trainIntradayModels = (...args) => run('mlService', 'trainIntradayModels', args, { algorithm: 'naiveBayes' });

export const trainEnsembleModel = (...args) => run('ensembleService', 'trainEnsembleModel', args, { algorithm: 'ensemble' });
export const predictWithEnsemble = (...args) => run('ensembleService', 'predictWithEnsemble', args, { algorithm: 'ensemble' });

export const trainLongTermEnsembleModel = (...args) => run('longTermEnsembleService', 'trainLongTermEnsembleModel', args, { algorithm: 'longTermEnsemble' });
export const predictWithLongTermEnsemble = (...args) => run('longTermEnsembleService', 'predictWithLongTermEnsemble', args, { algorithm: 'longTermEnsemble' });

export const trainLongTermLSTM = (...args) => run('longTermLSTMService', 'trainLongTermLSTM', args, { algorithm: 'longTermLSTM' });
export const predictLongTermWithConfidence = (...args) => run('longTermLSTMService', 'predictLongTermWithConfidence', args, { algorithm: 'longTermLSTM' });
export const normalizeNewLongTermFeatures = (...args) => run('longTermLSTMService', 'normalizeNewLongTermFeatures', args, { algorithm: 'longTermLSTM' });
export const evaluateLongTermLSTM = (...args) => run('longTermLSTMService', 'evaluateLongTermLSTM', args, { algorithm: 'longTermLSTM' });

export const trainLinearRegressionMultiTimeframe = (...args) => run('linearRegressionService', 'trainLinearRegressionMultiTimeframe', args, { algorithm: 'linearRegression' });
export const trainLinearRegression = (...args) => run('linearRegressionService', 'trainLinearRegression', args, { algorithm: 'linearRegression' });
export const predictWithLinearRegression = (...args) => run('linearRegressionService', 'predictWithLinearRegression', args, { algorithm: 'linearRegression' });

export const createInstitutionalLinearRegression = (...args) => run('institutionalLinearRegressionService', 'createInstitutionalLinearRegression', args, { algorithm: 'institutionalRegression' });
export const compareInstitutionalModels = (...args) => run('institutionalLinearRegressionService', 'compareInstitutionalModels', args, { algorithm: 'institutionalRegression' });
export const predictWithInstitutionalModel = (...args) => run('institutionalLinearRegressionService', 'predictWithInstitutionalModel', args, { algorithm: 'institutionalRegression' });

export const trainXGBoostModel = (...args) => run('xgBoostStockService', 'trainXGBoostModel', args, { algorithm: 'xgboost' });
export const predictWithXGBoost = (...args) => run('xgBoostStockService', 'predictWithXGBoost', args, { algorithm: 'xgboost' });

export const trainLongTermRandomForest = (...args) => run('longTermRandomForestService', 'trainLongTermRandomForest', args, { algorithm: 'longTermRandomForest' });
export const prepareLatestLongTermFeatures = (...args) => run('longTermRandomForestService', 'prepareLatestLongTermFeatures', args, { algorithm: 'longTermRandomForest' });

export const trainLongTermNaiveBayes = (...args) => run('longTermNaiveBayesService', 'trainLongTermNaiveBayes', args, { algorithm: 'longTermNaiveBayes' });
export const prepareLatestLongTermNBFeatures = (...args) => run('longTermNaiveBayesService', 'prepareLatestLongTermNBFeatures', args, { algorithm: 'longTermNaiveBayes' });
export const discretizeLongTermPredictionSample = (...args) => run('longTermNaiveBayesService', 'discretizeLongTermPredictionSample', args, { algorithm: 'longTermNaiveBayes' });

export const buildAndTrainLSTMModel = (...args) => run('lstmModel', 'buildAndTrainLSTMModel', args, { algorithm: 'bottomPeakLSTM' });
export const predictBottomsPeaks = (...args) => run('lstmModel', 'predictBottomsPeaks', args, { algorithm: 'bottomPeakLSTM' });
export const evaluateModel = (...args) => run('lstmModel', 'evaluateModel', args, { algorithm: 'bottomPeakLSTM' });
export const modelExists = async () => false;
export const saveModel = async () => true;
export const loadModel = async () => {
  throw new Error('Model persistence moved to backend queue flow; retrain model to continue');
};
export const deleteModel = async () => true;

export const createEnsemblePredictor = () => ({ trained: false });
export const createLongTermEnsemblePredictor = () => ({ trained: false });
export const createXGBoostPredictor = () => ({ trained: false });
export class RandomForestClassifier {}
export class LongTermRandomForestClassifier {}
export class RealTimePredictionEngine {}