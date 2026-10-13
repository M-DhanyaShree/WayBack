# Wayback ML

This directory contains the training pipeline and ONNX models for Wayback's recommendation engine.

## Structure

```
ml/
  training/
    dataset.py    # Extracts features from PostgreSQL
    train.py      # Trains XGBoost models and exports to ONNX
  models/
    acceptance_model.onnx   (generated after training)
    delivery_model.onnx     (generated after training)
  requirements.txt
```

## Training

```bash
cd backend/ml
pip install -r requirements.txt
python training/train.py
```

The models are loaded automatically by the Node.js server at startup.
If models are not present, the system falls back to heuristic scoring.
