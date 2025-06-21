import designers from '../../data/designers.json';

export default function handler(req, res) {
  res.status(200).json(designers);
} 