import Constants, { ExecutionEnvironment } from 'expo-constants';

/** Expo Go has no native share-extension module: sharing only works in an installed build. */
export const SHARE_AVAILABLE = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
