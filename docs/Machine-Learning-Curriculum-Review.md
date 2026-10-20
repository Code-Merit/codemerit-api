# Machine Learning Curriculum — Review

**Status:** Restructured and applied (dev DB + seed files), 2026-10-20. Ready for question authoring.  
**Subject slug:** `machine-learning` (id 23)  
**Audience:** learners with basic Python and comfort with tabular data. Calculus and linear algebra are not prerequisites; the needed intuition is introduced in-topic.  
**Content today:** 0 questions, 0 lessons, 0 badges. Trivia plan: [Machine-Learning-Trivia-Question-Plan.md](Machine-Learning-Trivia-Question-Plan.md).

## Subject overview

Learn machine learning step by step: how models learn, how to prepare data and test models honestly, supervised and unsupervised methods, deep learning for images, text and LLMs, and how to run models responsibly in production.

## Curriculum model

- One `machine-learning` subject with **22 topics** in curriculum order (`order` 1–22, no gaps).
- **5 subject tracks.** Every topic belongs to **exactly one** track, so tracks and certificates measure distinct progress. The earlier draft's shared topics were removed on 2026-10-20.
- Topic descriptions follow one format: a short lead sentence, then "Covers:" with exactly **5 comma-separated sub-topics**, plus a one-sentence goal starting "You'll be able to…". The sub-topics are the checklist that questions are planned against.
- Completion rules (platform-wide): a topic is done at 70% trivia coverage, a track at 70% of its topics, and a certificate at its `passThreshold` share of linked tracks.

## Topic catalogue

| # | Topic | Level | Track | Description | Goal |
|---:|---|---|---|---|---|
| 1 | **Introduction to Machine Learning**<br>`ml-introduction` | Foundation | `ml-foundations` | Learn what machine learning is and how a model learns from data. Covers: types of machine learning, features and labels, training vs inference, overfitting and underfitting, and the ML workflow. | You'll be able to explain how ML works in plain words and use its core terms correctly. |
| 2 | **Problem Framing and Baselines**<br>`ml-problem-framing-baselines` | Foundation | `ml-foundations` | Learn how to turn a real-world problem into a clear ML task. Covers: choosing the task type, the target and inputs, success metrics, simple baselines, and when not to use ML. | You'll be able to frame a product problem as an ML task and judge whether ML is the right tool. |
| 3 | **Data Preparation**<br>`ml-data-preparation` | Foundation | `ml-foundations` | Learn how to clean and transform raw data so a model can learn from it. Covers: exploring a dataset, missing values, invalid records and outliers, encoding categories, and feature scaling. | You'll be able to clean and transform a raw dataset and explain why each step was needed. |
| 4 | **Statistics and Probability for ML**<br>`ml-statistics-probability` | Foundation | `ml-foundations` | Learn the core statistics needed to read data and model results correctly. Covers: averages and spread, distributions, sampling, probability basics, and confidence and uncertainty. | You'll be able to tell whether a difference between two results is meaningful or just noise. |
| 5 | **Validation, Splits, and Data Leakage**<br>`ml-validation-and-data-leakage` | Foundation | `ml-foundations` | Learn how to test a model honestly so its score reflects real use. Covers: train and test splits, cross-validation, time and group splits, data leakage, and the final test set. | You'll be able to choose the right way to split data and spot leakage before it skews results. |
| 6 | **Regression Models**<br>`ml-regression-models` | Intermediate | `ml-supervised-learning` | Learn how to predict numbers, such as prices, demand or delivery times. Covers: linear regression, Ridge and Lasso regularization, error metrics like RMSE and R², residual analysis, and model limitations. | You'll be able to build a regression model, compare it with a baseline, and explain its errors. |
| 7 | **Classification Models**<br>`ml-classification-models` | Intermediate | `ml-supervised-learning` | Learn how to predict categories, such as spam or not spam. Covers: logistic regression, kNN and SVM, the confusion matrix, precision and recall, and decision thresholds. | You'll be able to pick a classifier, choose the right metric, and set a sensible threshold. |
| 8 | **Decision Trees and Ensemble Methods**<br>`ml-trees-ensembles` | Intermediate | `ml-supervised-learning` | Learn the tree-based models behind most real-world tabular ML. Covers: how decision trees split, pruning, random forests, gradient boosting, and feature importance. | You'll be able to train and tune tree-based models and explain why ensembles beat a single tree. |
| 9 | **Feature Engineering and Pipelines**<br>`ml-feature-engineering-pipelines` | Intermediate | `ml-supervised-learning` | Learn how to create better features and make preprocessing repeatable. Covers: features from raw data, date and text features, feature selection, pipelines, and train and serve consistency. | You'll be able to build a reusable pipeline and show which features actually improve a model. |
| 10 | **Model Selection and Hyperparameter Tuning**<br>`ml-model-selection-tuning` | Intermediate | `ml-supervised-learning` | Learn how to compare models and tune their settings fairly. Covers: parameters vs hyperparameters, grid and random search, cross-validated tuning, learning curves, and overfitting the validation set. | You'll be able to run a fair model comparison, tune the best candidate, and report its score. |
| 11 | **Model Interpretation and Calibration**<br>`ml-interpretability-calibration` | Intermediate | `ml-supervised-learning` | Learn how to explain a model's predictions and check its probabilities. Covers: feature importance, SHAP and LIME, probability calibration, errors across groups, and correlation vs causation. | You'll be able to explain why a model predicts what it does and whether its confidence holds. |
| 12 | **Clustering**<br>`ml-clustering` | Intermediate | `ml-unsupervised-feature-engineering` | Learn how to group similar records when the data has no labels. Covers: k-means, hierarchical clustering, DBSCAN, choosing the number of clusters, and interpreting clusters carefully. | You'll be able to segment a dataset into meaningful groups and judge whether they are real. |
| 13 | **Dimensionality Reduction**<br>`ml-dimensionality-reduction` | Intermediate | `ml-unsupervised-feature-engineering` | Learn how to shrink many features into a few that keep what matters. Covers: the curse of dimensionality, PCA, t-SNE and UMAP, feature selection vs extraction, and when reduction helps. | You'll be able to reduce a high-dimensional dataset and choose the right method for the job. |
| 14 | **Anomaly Detection**<br>`ml-anomaly-detection` | Intermediate | `ml-unsupervised-feature-engineering` | Learn how to spot rare or unusual events, such as fraud or faults. Covers: types of anomalies, statistical methods, isolation forest, choosing thresholds, and false alarms vs missed events. | You'll be able to set up anomaly detection and balance alert volume against missed cases. |
| 15 | **Neural Network Foundations**<br>`ml-neural-network-foundations` | Advanced | `ml-deep-learning-modern-ai` | Learn how a neural network learns from data, step by step. Covers: neurons and layers, activation functions, loss functions, backpropagation and gradient descent, and regularization. | You'll be able to explain how a network predicts, measures its error, and adjusts its weights. |
| 16 | **Deep Learning Workflows**<br>`ml-deep-learning-workflows` | Advanced | `ml-deep-learning-modern-ai` | Learn how to train and debug neural networks in practice. Covers: PyTorch and TensorFlow, batches and epochs, training and validation curves, early stopping, and when deep learning pays off. | You'll be able to run a small deep-learning experiment, read its curves, and judge the result. |
| 17 | **Computer Vision and CNNs**<br>`ml-computer-vision-cnns` | Advanced | `ml-deep-learning-modern-ai` | Learn how neural networks understand and classify images. Covers: images as pixel arrays, convolution and pooling, CNN architectures, data augmentation, and transfer learning. | You'll be able to explain how a CNN sees an image and fine-tune a pre-trained model for a task. |
| 18 | **NLP, Embeddings, and Transformers**<br>`ml-nlp-embeddings-transformers` | Advanced | `ml-deep-learning-modern-ai` | Learn how computers turn text into numbers they can work with. Covers: tokenization, word and sentence embeddings, semantic similarity, attention, and the transformer architecture. | You'll be able to use embeddings for semantic search and explain how transformers use context. |
| 19 | **LLM Applications and Evaluation**<br>`ml-llm-applications-evaluation` | Advanced | `ml-deep-learning-modern-ai` | Learn how to build applications with large language models and test them. Covers: prompting basics, retrieval-augmented generation, evaluating answers, hallucinations, and cost and latency. | You'll be able to design an LLM feature, test it on real examples, and guard against failures. |
| 20 | **Model Deployment and Serving**<br>`ml-model-deployment-inference` | Advanced | `ml-production` | Learn how to take a trained model into production safely. Covers: batch vs real-time inference, saving and versioning models, serving through an API, input contracts, and handling bad inputs. | You'll be able to choose a deployment approach and set up reliable predictions in production. |
| 21 | **Monitoring, Drift, and Maintenance**<br>`ml-monitoring-drift-maintenance` | Advanced | `ml-production` | Learn how to keep a deployed model healthy over time. Covers: monitoring inputs and predictions, data and concept drift, performance decay, alerts and thresholds, and retraining triggers. | You'll be able to catch model problems early and decide when a model needs retraining. |
| 22 | **Responsible, Private, and Secure ML**<br>`ml-responsible-secure-practice` | Advanced | `ml-production` | Learn how to build ML systems that are fair, private and safe to use. Covers: bias and fairness, privacy and data handling, adversarial attacks, human oversight, and model cards. | You'll be able to identify the main risks of an ML system and put sensible safeguards in place. |

## Subject tracks

### 1. ML Foundations — `ml-foundations`

Start here: what machine learning is, how to frame a problem, prepare data, read results with basic statistics, and test models honestly.

**Topics (5):** 1. Introduction to Machine Learning · 2. Problem Framing and Baselines · 3. Data Preparation · 4. Statistics and Probability for ML · 5. Validation, Splits, and Data Leakage

### 2. Supervised Learning — `ml-supervised-learning`

Learn to predict numbers and categories from labelled data: regression, classification, tree-based ensembles, feature engineering, tuning, and interpretation.

**Topics (6):** 6. Regression Models · 7. Classification Models · 8. Decision Trees and Ensemble Methods · 9. Feature Engineering and Pipelines · 10. Model Selection and Hyperparameter Tuning · 11. Model Interpretation and Calibration

### 3. Unsupervised Learning — `ml-unsupervised-feature-engineering`

Find structure in data without labels: clustering, dimensionality reduction, and anomaly detection.

**Topics (3):** 12. Clustering · 13. Dimensionality Reduction · 14. Anomaly Detection

### 4. Deep Learning — `ml-deep-learning-modern-ai`

Learn how neural networks are trained and applied to images, text, and large language models.

**Topics (5):** 15. Neural Network Foundations · 16. Deep Learning Workflows · 17. Computer Vision and CNNs · 18. NLP, Embeddings, and Transformers · 19. LLM Applications and Evaluation

### 5. Production Machine Learning — `ml-production`

Take models into production and keep them healthy: deployment, monitoring and drift, and responsible, private, and secure ML.

**Topics (3):** 20. Model Deployment and Serving · 21. Monitoring, Drift, and Maintenance · 22. Responsible, Private, and Secure ML

Track **slugs** are unchanged from the first draft, even where the title changed (for example `ml-unsupervised-feature-engineering` is now titled "Unsupervised Learning"). `03-programs.seed.json` refers to tracks by slug.

## Certification ladder

Subject-native certificates (`subjectId` = Machine Learning). Each has `passThreshold: 100`: every linked track must be completed. The ladder is cumulative.

| Certificate | Slug | Linked tracks | Job roles | Scope |
|---|---|---|---|---|
| Machine Learning Foundations | `machine-learning-foundations` | ml-foundations | — | You can frame an ML problem, prepare data responsibly, reason about uncertainty, and design an evaluation that avoids common leakage and validation errors. |
| Applied Machine Learning Practitioner | `applied-machine-learning-practitioner` | ml-foundations, ml-supervised-learning, ml-unsupervised-feature-engineering | AI/ML Engineer, ML Engineer | You can build and assess supervised prediction models and unsupervised workflows, choose evaluation methods suited to the problem, and produce reproducible results. |
| Machine Learning Engineer | `machine-learning-engineer` | ml-foundations, ml-supervised-learning, ml-unsupervised-feature-engineering, ml-deep-learning-modern-ai, ml-production | — | You can carry machine-learning work from problem framing and model evaluation through modern AI applications, deployment, monitoring, and responsible operation. |

**Role certificates that use Machine Learning tracks** (from the 2026-10-20 certification mapping fix):

- #123 AI Foundations: ml-foundations
- #125 AI/ML Engineer: ml-foundations, ml-supervised-learning, ml-unsupervised-feature-engineering, ml-deep-learning-modern-ai
- #126 ML Infrastructure Engineer: ml-foundations, ml-production

## Seed integrity

1. Seed order: `01-core` (subjects) → `02-curriculum` (topics, tracks, track-topic links) → `03-programs` (certificates and their links) → questions.
2. All references use slugs or titles, never database ids. A cross-file check on 2026-10-20 found 0 unresolved references.
3. Topic slugs are stable from here on. `ml-unsupervised-learning` was renamed to `ml-clustering` during the restructure, and nothing references the old slug.
4. Seeders are insert-only (they never update or prune). The seed files describe a fresh v1 install, and they match the dev DB exactly.
5. Ids: the dev DB is the v1 baseline, and new rows should take the next id with no gaps. A rolled-back insert still burns AUTO_INCREMENT ids, so reset the counter to `MAX(id)+1` before inserting after any failed or dry run.

## Change log

- **2026-10-20 — restructure.** 18 → 22 topics. Added: Introduction to Machine Learning, Decision Trees and Ensemble Methods, Dimensionality Reduction, Computer Vision and CNNs. Split "Unsupervised Learning" into Clustering and Dimensionality Reduction, narrowed Classification to non-tree models, and moved overfitting / bias–variance basics into the Introduction. Removed every shared topic, so each topic now sits in one track. Renamed tracks 2–4 and rewrote all descriptions in the consistent 5-sub-topic format.
- **2026-10-20 — certificates.** AI Foundations (role cert) now uses ML Foundations, and Applied Machine Learning Practitioner is linked to the AI/ML Engineer and ML Engineer roles.

## Decisions

- **Resolved:** basic Python is the prerequisite, and statistics is taught inside ML Foundations.
- **Resolved:** five tracks, one track per topic. Deep Learning stays in the main ladder, not an optional specialization.
- **Resolved:** `passThreshold: 100` is kept for all three certificates.
- **Open:** whether Machine Learning Foundations and Machine Learning Engineer should also be linked to the ML job roles (Applied Machine Learning Practitioner already is).
- **Open:** subject badges (none yet).
