import { Dependencies } from '@rebel/context/ContextProvider';
import IFactory from '@rebel/factories/IFactory';
import { Masterchat } from 'masterchat';

export default class MasterchatFactory implements IFactory<Masterchat> {
  constructor (dependencies: Dependencies) {

  }

  public create () {
    return null!//new Masterchat()
  }
}