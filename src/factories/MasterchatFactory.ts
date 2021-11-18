import { Dependencies } from '@context/ContextProvider';
import IFactory from '@factories/IFactory';
import { Masterchat } from 'masterchat';

export default class MasterchatFactory implements IFactory<Masterchat> {
  constructor (dependencies: Dependencies) {

  }

  public create () {
    return null!//new Masterchat()
  }
}