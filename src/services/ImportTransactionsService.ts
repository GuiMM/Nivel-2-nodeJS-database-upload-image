import fs from 'fs';
import csvParse from 'csv-parse';
import { getCustomRepository, getRepository, In } from 'typeorm';
import Transaction from '../models/Transaction';
import TransactionRepository from '../repositories/TransactionsRepository';
import Category from '../models/Category';

interface CSVTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}
class ImportTransactionsService {
  async execute(filePath: string): Promise<Transaction[]> {
    const transactionRepository = getCustomRepository(TransactionRepository);
    const categoryRepository = getRepository(Category);
    const contactsReadStream = fs.createReadStream(filePath);
    const parses = csvParse({
      delimiter: ',',
      from_line: 2,
    });
    const parseCSV = contactsReadStream.pipe(parses);
    const transactions: CSVTransaction[] = [];
    const categories: string[] = [];

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );
      if (!title || !type || !value) return;
      categories.push(category);
      transactions.push({ title, type, value, category });
    });

    await new Promise(resolve => parseCSV.on('end', resolve));
    const existsCategories = await categoryRepository.find({
      where: {
        title: In(categories),
      },
    });
    const existsCategoryTitles = existsCategories.map(
      (category: Category) => category.title,
    );
    // retira duplicatas e categorias que ja estao cadastradas no bd
    const addCategoryTitles = categories
      .filter(category => !existsCategoryTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    const newCategories = categoryRepository.create(
      addCategoryTitles.map(title => ({
        title,
      })),
    );
    await categoryRepository.save(newCategories);
    const finalCategories = [...newCategories, ...existsCategories];
    const createdTransactions = transactionRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: finalCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );
    await transactionRepository.save(createdTransactions);
    await fs.promises.unlink(filePath);
    console.log(categoryRepository);
    return createdTransactions;
  }
}

export default ImportTransactionsService;
