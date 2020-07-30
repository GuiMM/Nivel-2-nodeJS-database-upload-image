import { getCustomRepository, getRepository } from 'typeorm';
import AppError from '../errors/AppError';
import TransactionRepository from '../repositories/TransactionsRepository';
import Transaction from '../models/Transaction';
import Category from '../models/Category';

interface Request {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: Request): Promise<Transaction> {
    const transactionRepository = getCustomRepository(TransactionRepository);
    const categoryRepository = getRepository(Category);

    const { total } = await transactionRepository.getBalance();

    if (type === 'outcome' && total < value) {
      throw new AppError('You do not have enough balance');
    }
    let transactioncategory = await categoryRepository.findOne({
      where: {
        title: category,
      },
    });

    if (!transactioncategory) {
      transactioncategory = categoryRepository.create({
        title: category,
      });
      await categoryRepository.save(transactioncategory);
    }

    const transaction = transactionRepository.create({
      title,
      value,
      type,
      category: transactioncategory,
    });
    await transactionRepository.save(transaction);
    return transaction;
  }
}

export default CreateTransactionService;
