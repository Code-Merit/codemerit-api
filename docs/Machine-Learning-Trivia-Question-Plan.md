# Machine Learning — Trivia Question Plan

**Status:** Plan for review. No questions written yet.
**Scope:** Trivia (4-option MCQ) only. 22 topics × 15 = **330 questions**.
**Curriculum:** the restructured 22-topic version (2026-10-20). Each topic has 5 "Covers:" sub-topics, and each sub-topic gets 3 questions.
**Audience assumption:** basic Python and tabular data. No calculus or linear-algebra derivations. Questions test intuition, judgement and correct use, not formulas to memorise.

## Quality rules (CodeMerit Question Quality Policy)

1. **No length tell.** The correct option is never noticeably longer or more specific than the distractors. All 4 options use the same grammatical shape and a similar length.
2. **Plausible distractors.** Each wrong option is a real misconception or a near-miss (a neighbouring concept, a common mistake, or a rule applied in the wrong place), never filler.
3. **Explanations (`answer`).** State the correct answer plainly, then add one or two simple sentences on *why*, including why the tempting distractor is wrong. Each question also gets a short `hint` that nudges the learner without giving the answer away.
4. **No duplicates.** Each concept is tested once across the whole subject. The ownership map below decides which topic owns a concept that appears in several topics.
5. **Honest difficulty.** Each question's level is judged on its own. Foundation topics skew Easy and Advanced topics skew harder. No quotas are forced.
6. **No padding.** 15 per topic is the plan because every topic has 5 rich sub-topics. If a sub-topic can't support 3 non-duplicate, high-quality questions while drafting, it gets fewer, and the gap is reported rather than filled.

**Question mix per topic:** about one third recall ("what is…"), one third understanding ("why / which is true"), and one third short applied scenarios ("a team sees X — what should they do?"). Scenario questions carry most of the Intermediate and Advanced weight.

**Platform conventions:** level 1 Easy = 1 mark, ~45–60 s · level 2 Intermediate = 2 marks, ~60 s · level 3 Advanced = 3 marks, ~75–90 s · 4 options, exactly one correct · `status: Active`.

## Concept ownership (de-duplication)

| Concept | Owned by | Others may only… |
|---|---|---|
| Overfitting / underfitting (definition, symptoms) | 1 Introduction | 10 tests *learning curves*; 15 tests *regularization techniques*; 16 tests *reading training curves*. None of them re-tests the definition |
| Data leakage | 5 Validation | 3 tests only *fit-on-train-only preprocessing* as a data-prep step; 9 tests *train/serve consistency* |
| Train/test split basics | 5 Validation | 1 mentions the workflow only, with no split mechanics |
| Feature importance | 11 Interpretation (permutation, SHAP-style) | 8 tests only *impurity-based importance from trees* and its bias |
| Probability calibration | 11 Interpretation | 7 tests *thresholds* only |
| Decision thresholds | 7 Classification | 14 tests *alert thresholds vs capacity* (operational framing) |
| Feature scaling | 3 Data Preparation | 12 tests only *why scaling matters for distance-based clustering* |
| Regularization in linear models (Ridge/Lasso) | 6 Regression | 15 tests NN regularization (dropout, weight decay) |
| Embeddings | 18 NLP | 19 tests *retrieval with embeddings* inside RAG only |
| Drift | 21 Monitoring | 19 and 20 don't test drift |
| Fairness / bias | 22 Responsible ML | 11 tests *errors across groups* as an evaluation step only |

Levels: **E** = Easy (1) · **I** = Intermediate (2) · **A** = Advanced (3).

---

## ML Foundations

### 1. Introduction to Machine Learning — Foundation · planned E 8 / I 6 / A 1
| # | Sub-topic | What the question tests | L |
|---|---|---|---|
| 1 | Types of machine learning | Supervised vs unsupervised: labelled vs unlabelled data | E |
| 2 | Types of machine learning | Matching a task (spam filter, customer segments, game agent) to its learning type | E |
| 3 | Types of machine learning | What makes reinforcement learning different (reward signal, not labelled examples) | I |
| 4 | Features and labels | Identifying the label in a house-price dataset | E |
| 5 | Features and labels | What a "feature" is vs a raw record | E |
| 6 | Features and labels | Why an ID column is a poor feature | I |
| 7 | Training vs inference | What happens during training (parameters are learned from data) | E |
| 8 | Training vs inference | Inference: applying a trained model to new inputs | E |
| 9 | Training vs inference | Why inference cost and latency matter differently from training cost | I |
| 10 | Overfitting and underfitting | Spotting overfitting from train vs test scores | E |
| 11 | Overfitting and underfitting | Spotting underfitting (both scores poor) | I |
| 12 | Overfitting and underfitting | Which change most likely reduces overfitting (more data / a simpler model) | I |
| 13 | The ML workflow | Correct order: frame → data → train → evaluate → deploy | E |
| 14 | The ML workflow | Why evaluation must use data the model hasn't seen | I |
| 15 | The ML workflow | ML as an iterative loop, not a one-pass pipeline (a scenario) | A |

### 2. Problem Framing and Baselines — Foundation · planned E 6 / I 7 / A 2
| # | Sub-topic | What the question tests | L |
|---|---|---|---|
| 1 | Choosing the task type | Regression vs classification for "predict delivery time" | E |
| 2 | Choosing the task type | Ranking vs classification for "which products to show first" | I |
| 3 | Choosing the task type | Reframing a vague goal ("reduce churn") into a predictable target | A |
| 4 | The target and inputs | Choosing a well-defined target that is actually recorded | I |
| 5 | The target and inputs | Unit of prediction (per user vs per transaction) | I |
| 6 | The target and inputs | Fixing the label window in advance so labels are comparable | I |
| 7 | Success metrics | Business metric vs model metric | E |
| 8 | Success metrics | Why accuracy misleads on a 99:1 dataset | E |
| 9 | Success metrics | Picking a metric when false negatives are costly | I |
| 10 | Simple baselines | What a baseline is and why it comes first | E |
| 11 | Simple baselines | Majority-class baseline for classification | E |
| 12 | Simple baselines | A complex model that barely beats the baseline: what it means | I |
| 13 | When not to use ML | A fixed business rule beats ML (scenario) | E |
| 14 | When not to use ML | Too little or no labelled data as a reason to wait | I |
| 15 | When not to use ML | High-stakes decisions that need full explainability | A |

### 3. Data Preparation — Foundation · planned E 7 / I 6 / A 2
| # | Sub-topic | What the question tests | L |
|---|---|---|---|
| 1 | Exploring a dataset | Why to inspect distributions before modelling | E |
| 2 | Exploring a dataset | Spotting a mislabelled column type (numbers stored as text) | E |
| 3 | Exploring a dataset | A suspicious column that is nearly identical to the target | I |
| 4 | Missing values | Dropping rows vs imputing: the trade-off | E |
| 5 | Missing values | Median vs mean imputation with skewed data | I |
| 6 | Missing values | Missingness itself carrying signal (adding an indicator) | A |
| 7 | Invalid records and outliers | A data-entry error vs a genuine outlier | E |
| 8 | Invalid records and outliers | An outlier's effect on a linear model | I |
| 9 | Invalid records and outliers | Capping (winsorising) vs removal | I |
| 10 | Encoding categories | One-hot encoding: what it produces | E |
| 11 | Encoding categories | Why label-encoding nominal categories misleads linear models | I |
| 12 | Encoding categories | High-cardinality categories (city IDs): sensible options | A |
| 13 | Feature scaling | Standardisation vs min-max scaling | E |
| 14 | Feature scaling | Which models are sensitive to scale (kNN, SVM) vs not (trees) | I |
| 15 | Feature scaling | Fitting the scaler on training data only | E |

### 4. Statistics and Probability for ML — Foundation · planned E 6 / I 7 / A 2
| # | Sub-topic | What the question tests | L |
|---|---|---|---|
| 1 | Averages and spread | The mode as the average for categories | E |
| 2 | Averages and spread | What standard deviation tells you | E |
| 3 | Averages and spread | Two datasets with the same mean but different spread (scenario) | I |
| 4 | Distributions | Recognising a skewed distribution | E |
| 5 | Distributions | When a log transform helps | I |
| 6 | Distributions | Normal-distribution intuition (most values near the mean) | E |
| 7 | Sampling | Why a sample must represent the population | E |
| 8 | Sampling | Sampling bias example (survey only of app users) | I |
| 9 | Sampling | Stratified sampling for rare classes | I |
| 10 | Probability basics | Independent events intuition | I |
| 11 | Probability basics | Conditional probability in a screening test (base rates) | A |
| 12 | Probability basics | What a predicted probability of 0.8 means | E |
| 13 | Confidence and uncertainty | A confidence interval in plain words | I |
| 14 | Confidence and uncertainty | Why a 1% accuracy gain on a small test set may be noise | I |
| 15 | Confidence and uncertainty | Statistical vs practical significance | A |

### 5. Validation, Splits, and Data Leakage — Foundation · planned E 5 / I 7 / A 3
| # | Sub-topic | What the question tests | L |
|---|---|---|---|
| 1 | Train and test splits | Purpose of a held-out test set | E |
| 2 | Train and test splits | Validation set vs test set roles | E |
| 3 | Train and test splits | Why to shuffle before a random split | I |
| 4 | Cross-validation | What k-fold cross-validation does | E |
| 5 | Cross-validation | Why cross-validation gives a more reliable estimate on small data | I |
| 6 | Cross-validation | The cost of many folds (leave-one-out) | I |
| 7 | Time and group splits | Why random splits fail for time-series forecasting | I |
| 8 | Time and group splits | Group split when one patient has many records | A |
| 9 | Time and group splits | Choosing the right split for a given scenario | I |
| 10 | Data leakage | Definition of data leakage | E |
| 11 | Data leakage | Target leakage example (a feature recorded after the outcome) | I |
| 12 | Data leakage | Leakage through duplicate records across the split | A |
| 13 | The final test set | Why the test set is used only once, at the end | E |
| 14 | The final test set | Test data must match production conditions | I |
| 15 | The final test set | A test score far below validation after heavy tuning | A |

## Supervised Learning

### 6. Regression Models — Intermediate · planned E 4 / I 8 / A 3
| # | Sub-topic | What the question tests | L |
|---|---|---|---|
| 1 | Linear regression | What a coefficient means | E |
| 2 | Linear regression | What linear regression assumes (a linear relationship) | I |
| 3 | Linear regression | Correlated features making coefficients unstable | A |
| 4 | Ridge and Lasso regularization | Why regularization reduces overfitting | E |
| 5 | Ridge and Lasso regularization | Lasso can shrink coefficients to zero (feature selection) | I |
| 6 | Ridge and Lasso regularization | Effect of increasing the regularization strength | I |
| 7 | Error metrics like RMSE and R² | MAE vs RMSE: RMSE punishes large errors more | I |
| 8 | Error metrics like RMSE and R² | What an R² of 0.7 means | E |
| 9 | Error metrics like RMSE and R² | A high R² while errors are still too large for the business | I |
| 10 | Residual analysis | What a residual is | E |
| 11 | Residual analysis | A curved residual pattern means a missed non-linearity | I |
| 12 | Residual analysis | Residuals that grow with the prediction (heteroscedasticity) | A |
| 13 | Model limitations | Extrapolating beyond the training range | I |
| 14 | Model limitations | Reporting a range around a prediction (uncertainty) | I |
| 15 | Model limitations | When to move beyond linear regression (scenario) | A |

### 7. Classification Models — Intermediate · planned E 4 / I 8 / A 3
| # | Sub-topic | What the question tests | L |
|---|---|---|---|
| 1 | Logistic regression | Logistic regression outputs a probability | E |
| 2 | Logistic regression | Why it's called regression yet used to classify | I |
| 3 | Logistic regression | Linear decision boundary limitations | A |
| 4 | kNN and SVM | How kNN decides a class | E |
| 5 | kNN and SVM | Effect of a small vs large k | I |
| 6 | kNN and SVM | SVM margin intuition and the role of kernels | A |
| 7 | The confusion matrix | Reading true and false positives | E |
| 8 | The confusion matrix | The costly error for a spam filter (false positive) | I |
| 9 | The confusion matrix | Deriving accuracy from a given matrix | I |
| 10 | Precision and recall | Precision vs recall definitions | E |
| 11 | Precision and recall | Why precision and recall usually trade off | I |
| 12 | Precision and recall | When F1 is preferred over accuracy | I |
| 13 | Decision thresholds | Lowering the threshold raises recall | I |
| 14 | Decision thresholds | Choosing a threshold from the cost of errors (scenario) | A |
| 15 | Decision thresholds | ROC curve vs PR curve under heavy imbalance | I |

### 8. Decision Trees and Ensemble Methods — Intermediate · planned E 4 / I 8 / A 3
| # | Sub-topic | What the question tests | L |
|---|---|---|---|
| 1 | How decision trees split | A tree splits to make child nodes purer | E |
| 2 | How decision trees split | Gini / entropy as impurity measures (intuition) | I |
| 3 | How decision trees split | Trees capture non-linear patterns without extra features | E |
| 4 | Pruning | A fully grown tree overfits | E |
| 5 | Pruning | Max depth / min samples as pre-pruning controls | I |
| 6 | Pruning | Choosing depth from validation results | I |
| 7 | Random forests | Bagging: trees on bootstrap samples | I |
| 8 | Random forests | Why random feature subsets decorrelate the trees | A |
| 9 | Random forests | Random forests reduce variance vs a single tree | I |
| 10 | Gradient boosting | Boosting fits each tree to the previous errors | I |
| 11 | Gradient boosting | Learning rate vs number of trees trade-off | A |
| 12 | Gradient boosting | Bagging vs boosting: which reduces bias vs variance | I |
| 13 | Feature importance | Reading impurity-based importance from a tree model | E |
| 14 | Feature importance | Bias of impurity importance toward high-cardinality features | A |
| 15 | Feature importance | Ensembles vs a single tree: when the extra complexity pays off | I |

### 9. Feature Engineering and Pipelines — Intermediate · planned E 4 / I 8 / A 3
| # | Sub-topic | What the question tests | L |
|---|---|---|---|
| 1 | Features from raw data | Ratio features (spend per visit) | E |
| 2 | Features from raw data | Aggregations over a customer's history | I |
| 3 | Features from raw data | Interaction features for linear models | A |
| 4 | Date and text features | Extracting day-of-week / hour from timestamps | E |
| 5 | Date and text features | Cyclical encoding of hour or month | A |
| 6 | Date and text features | Bag-of-words / TF-IDF for short text | I |
| 7 | Feature selection | Why to remove redundant features | E |
| 8 | Feature selection | Filter vs wrapper selection (intuition) | I |
| 9 | Feature selection | Embedded selection (Lasso, trees) during training | I |
| 10 | Pipelines | What a pipeline bundles (preprocessing + model) | E |
| 11 | Pipelines | Pipelines prevent leakage inside cross-validation | I |
| 12 | Pipelines | Handling numeric and categorical columns differently in one pipeline | I |
| 13 | Train and serve consistency | Training/serving skew: definition | I |
| 14 | Train and serve consistency | Saving the fitted preprocessing with the model | I |
| 15 | Train and serve consistency | A feature computed differently in production (scenario) | A |

### 10. Model Selection and Hyperparameter Tuning — Intermediate · planned E 3 / I 9 / A 3
| # | Sub-topic | What the question tests | L |
|---|---|---|---|
| 1 | Parameters vs hyperparameters | Which is learned and which is set | E |
| 2 | Parameters vs hyperparameters | Classifying examples (tree depth, coefficients, k) | E |
| 3 | Parameters vs hyperparameters | Why hyperparameters are tuned on validation data | I |
| 4 | Grid and random search | How grid search works | E |
| 5 | Grid and random search | Why random search often finds good settings faster | I |
| 6 | Grid and random search | Why a full grid explodes with many hyperparameters | A |
| 7 | Cross-validated tuning | Tuning inside cross-validation | I |
| 8 | Cross-validated tuning | Nested cross-validation for an honest estimate | A |
| 9 | Cross-validated tuning | Comparing two models fairly with the same folds | I |
| 10 | Learning curves | Reading a learning curve: more data would help | I |
| 11 | Learning curves | High-bias vs high-variance curve shapes | I |
| 12 | Learning curves | When to stop collecting data (scenario) | A |
| 13 | Overfitting the validation set | Reporting the spread of cross-validation scores | I |
| 14 | Overfitting the validation set | Searching learning rate / regularization on a log scale | I |
| 15 | Overfitting the validation set | Choosing a simpler model with similar validation scores | I |

### 11. Model Interpretation and Calibration — Intermediate · planned E 3 / I 8 / A 4
| # | Sub-topic | What the question tests | L |
|---|---|---|---|
| 1 | Feature importance | Global vs local explanations | E |
| 2 | Feature importance | Permutation importance: how it works | I |
| 3 | Feature importance | Correlated features splitting importance | A |
| 4 | SHAP and LIME | What a SHAP value represents (a feature's contribution) | I |
| 5 | SHAP and LIME | LIME's local surrogate idea | I |
| 6 | SHAP and LIME | Explaining one loan decision to a customer (scenario) | I |
| 7 | Probability calibration | What a well-calibrated model means | E |
| 8 | Probability calibration | Reading a reliability diagram | A |
| 9 | Probability calibration | When calibration matters (risk scores, pricing) | I |
| 10 | Errors across groups | Why to compare error rates across subgroups | E |
| 11 | Errors across groups | A good overall score hiding a weak subgroup (scenario) | I |
| 12 | Errors across groups | Choosing meaningful subgroups to check | I |
| 13 | Correlation vs causation | An important feature is not necessarily a cause | I |
| 14 | Correlation vs causation | A confounding example in model explanations | A |
| 15 | Correlation vs causation | What explanation tools can and can't claim | A |

## Unsupervised Learning

### 12. Clustering — Intermediate · planned E 5 / I 7 / A 3
| # | Sub-topic | What the question tests | L |
|---|---|---|---|
| 1 | k-means | How k-means assigns points to centroids | E |
| 2 | k-means | Why k-means needs k chosen up front | E |
| 3 | k-means | k-means struggling with non-spherical clusters | A |
| 4 | Hierarchical clustering | What a dendrogram shows | E |
| 5 | Hierarchical clustering | Agglomerative (bottom-up) process | I |
| 6 | Hierarchical clustering | Choosing where to cut the dendrogram | I |
| 7 | DBSCAN | DBSCAN finds dense regions and labels noise | I |
| 8 | DBSCAN | DBSCAN doesn't need k | E |
| 9 | DBSCAN | Effect of eps / min-samples on the results | A |
| 10 | Choosing the number of clusters | The elbow method intuition | I |
| 11 | Choosing the number of clusters | Silhouette score meaning | I |
| 12 | Choosing the number of clusters | The "right" k depends on how the groups will be used | E |
| 13 | Interpreting clusters carefully | Clusters aren't guaranteed real-world categories | I |
| 14 | Interpreting clusters carefully | Checking that clusters are stable across runs | I |
| 15 | Interpreting clusters carefully | Profiling segments for a marketing team (scenario) | A |

### 13. Dimensionality Reduction — Intermediate · planned E 4 / I 8 / A 3
| # | Sub-topic | What the question tests | L |
|---|---|---|---|
| 1 | The curse of dimensionality | Data becoming sparse as dimensions grow | I |
| 2 | The curse of dimensionality | Why distances become less meaningful in high dimensions | A |
| 3 | The curse of dimensionality | More features hurting a model with little data | I |
| 4 | PCA | What a principal component is (direction of most variance) | E |
| 5 | PCA | Explained-variance ratio for choosing components | I |
| 6 | PCA | Why to scale before PCA | I |
| 7 | t-SNE and UMAP | Used for visualisation, not as model features | E |
| 8 | t-SNE and UMAP | Why distances between t-SNE clusters can't be trusted | A |
| 9 | t-SNE and UMAP | UMAP vs t-SNE trade-offs (speed, global structure) | I |
| 10 | Feature selection vs extraction | Selection keeps original features; extraction creates new ones | E |
| 11 | Feature selection vs extraction | Which keeps interpretability | I |
| 12 | Feature selection vs extraction | Choosing one for a regulated model (scenario) | I |
| 13 | When reduction helps | Speeding up training on wide data | E |
| 14 | When reduction helps | When reduction removes useful signal | I |
| 15 | When reduction helps | Reduction before clustering (scenario) | A |

### 14. Anomaly Detection — Intermediate · planned E 4 / I 8 / A 3
| # | Sub-topic | What the question tests | L |
|---|---|---|---|
| 1 | Types of anomalies | Point vs contextual anomalies | I |
| 2 | Types of anomalies | Collective anomalies (a sequence that's odd together) | A |
| 3 | Types of anomalies | Why anomaly detection is often unsupervised | E |
| 4 | Statistical methods | z-score threshold intuition | E |
| 5 | Statistical methods | IQR rule for outliers | I |
| 6 | Statistical methods | Why statistical rules fail on seasonal data | I |
| 7 | Isolation forest | Anomalies isolate with fewer random splits | I |
| 8 | Isolation forest | The contamination parameter's role | I |
| 9 | Isolation forest | Isolation forest vs a supervised classifier when labels exist | A |
| 10 | Choosing thresholds | Alert threshold vs the team's review capacity | I |
| 11 | Choosing thresholds | Alerts doubling after a holiday: seasonal shift vs real anomalies | A |
| 12 | Choosing thresholds | Tuning a threshold with a few labelled cases | I |
| 13 | False alarms vs missed events | Cost of false alarms (alert fatigue) | E |
| 14 | False alarms vs missed events | When missed events cost far more (fraud, safety) | E |
| 15 | False alarms vs missed events | Picking an operating point (scenario) | I |

## Deep Learning

### 15. Neural Network Foundations — Advanced · planned E 3 / I 8 / A 4
| # | Sub-topic | What the question tests | L |
|---|---|---|---|
| 1 | Neurons and layers | What a single neuron computes (weighted sum + activation) | E |
| 2 | Neurons and layers | Input, hidden and output layers | E |
| 3 | Neurons and layers | Why depth lets a network learn complex patterns | I |
| 4 | Activation functions | Why non-linear activations are needed | I |
| 5 | Activation functions | ReLU vs sigmoid in hidden layers | I |
| 6 | Activation functions | Softmax for multi-class output | E |
| 7 | Loss functions | What a loss function measures | I |
| 8 | Loss functions | Cross-entropy for classification vs MSE for regression | I |
| 9 | Loss functions | Matching the output layer and loss to the task | A |
| 10 | Backpropagation and gradient descent | Gradient descent intuition (steps downhill) | I |
| 11 | Backpropagation and gradient descent | Effect of a learning rate that's too high or too low | I |
| 12 | Backpropagation and gradient descent | Vanishing gradients and why ReLU helps | A |
| 13 | Regularization | Dropout: what it does during training | I |
| 14 | Regularization | Weight decay intuition | A |
| 15 | Regularization | Too much regularization (dropout) causing underfitting | A |

### 16. Deep Learning Workflows — Advanced · planned E 3 / I 8 / A 4
| # | Sub-topic | What the question tests | L |
|---|---|---|---|
| 1 | PyTorch and TensorFlow | What a deep-learning framework provides (tensors, autograd) | E |
| 2 | PyTorch and TensorFlow | Using a GPU for training | E |
| 3 | PyTorch and TensorFlow | Why to set random seeds for reproducibility | I |
| 4 | Batches and epochs | Batch vs epoch definitions | E |
| 5 | Batches and epochs | Effect of batch size on memory and stability | I |
| 6 | Batches and epochs | Iterations per epoch calculation | I |
| 7 | Training and validation curves | A diverging validation loss means overfitting | I |
| 8 | Training and validation curves | Both losses flat and high: underfitting or a bug | A |
| 9 | Training and validation curves | A loss that jumps around: learning-rate issues | I |
| 10 | Early stopping | What early stopping does | I |
| 11 | Early stopping | The patience setting | I |
| 12 | Early stopping | Keeping the best checkpoint, not the last one | A |
| 13 | When deep learning pays off | Tabular data where gradient boosting often wins | A |
| 14 | When deep learning pays off | Images, audio and text favour deep learning | I |
| 15 | When deep learning pays off | Data and compute needs as a decision factor (scenario) | A |

### 17. Computer Vision and CNNs — Advanced · planned E 3 / I 8 / A 4
| # | Sub-topic | What the question tests | L |
|---|---|---|---|
| 1 | Images as pixel arrays | An image as height × width × channels | E |
| 2 | Images as pixel arrays | Why pixel values are normalised | I |
| 3 | Images as pixel arrays | Why a plain dense network scales badly to images | I |
| 4 | Convolution and pooling | What a convolutional filter detects | I |
| 5 | Convolution and pooling | Weight sharing as the reason CNNs are efficient | A |
| 6 | Convolution and pooling | What max pooling does | E |
| 7 | CNN architectures | Early layers learn edges, later layers learn shapes | I |
| 8 | CNN architectures | Why skip connections (ResNet) help very deep networks | A |
| 9 | CNN architectures | Feature maps shrink while channels grow with depth | E |
| 10 | Data augmentation | What augmentation is | I |
| 11 | Data augmentation | Choosing safe augmentations (no flips for digits like 6 and 9) | A |
| 12 | Data augmentation | Augmentation as regularization | I |
| 13 | Transfer learning | Why to reuse a pre-trained model | I |
| 14 | Transfer learning | Freezing early layers with a small dataset | A |
| 15 | Transfer learning | Classification vs object detection outputs | I |

### 18. NLP, Embeddings, and Transformers — Advanced · planned E 3 / I 8 / A 4
| # | Sub-topic | What the question tests | L |
|---|---|---|---|
| 1 | Tokenization | What a token is | E |
| 2 | Tokenization | Subword tokenization handling unseen words | I |
| 3 | Tokenization | Why token counts matter for the context window | I |
| 4 | Word and sentence embeddings | An embedding as a vector of meaning | E |
| 5 | Word and sentence embeddings | Similar words sit close together in embedding space | I |
| 6 | Word and sentence embeddings | Sentence vs word embeddings for search | I |
| 7 | Semantic similarity | Cosine similarity intuition | I |
| 8 | Semantic similarity | Keyword search vs semantic search | E |
| 9 | Semantic similarity | A semantic search failure (negation, exact codes) | A |
| 10 | Attention | What attention lets a model focus on | I |
| 11 | Attention | Self-attention: each token relates to the others | A |
| 12 | Attention | Why attention beats fixed-window context | I |
| 13 | The transformer architecture | Transformers process tokens in parallel | I |
| 14 | The transformer architecture | Positional information is needed because of that | A |
| 15 | The transformer architecture | Encoder vs decoder models (BERT vs GPT) | A |

### 19. LLM Applications and Evaluation — Advanced · planned E 3 / I 8 / A 4
| # | Sub-topic | What the question tests | L |
|---|---|---|---|
| 1 | Prompting basics | Clear instructions and examples improve output | E |
| 2 | Prompting basics | Few-shot prompting | I |
| 3 | Prompting basics | When prompting isn't enough (the knowledge isn't in the model) | I |
| 4 | Retrieval-augmented generation | What RAG adds (relevant documents in the prompt) | E |
| 5 | Retrieval-augmented generation | Retrieval with embeddings and chunking | I |
| 6 | Retrieval-augmented generation | A good model with wrong retrieved chunks: what fails | A |
| 7 | Evaluating answers | Building a test set of real questions | I |
| 8 | Evaluating answers | Evaluating retrieval and answer quality separately | A |
| 9 | Evaluating answers | Limits of using an LLM to judge an LLM | A |
| 10 | Hallucinations | What a hallucination is | E |
| 11 | Hallucinations | Grounding answers and citing sources | I |
| 12 | Hallucinations | Asking the model to say "I don't know" | I |
| 13 | Cost and latency | Token usage driving cost | I |
| 14 | Cost and latency | Caching and smaller models for speed | I |
| 15 | Cost and latency | When a database query beats an LLM (scenario) | A |

## Production Machine Learning

### 20. Model Deployment and Serving — Advanced · planned E 4 / I 8 / A 3
| # | Sub-topic | What the question tests | L |
|---|---|---|---|
| 1 | Batch vs real-time inference | Batch scoring for nightly reports | E |
| 2 | Batch vs real-time inference | Real-time inference for fraud checks at checkout | E |
| 3 | Batch vs real-time inference | Choosing between them for a given scenario | I |
| 4 | Saving and versioning models | Why to version models | E |
| 5 | Saving and versioning models | What to store alongside the model (preprocessing, metadata) | I |
| 6 | Saving and versioning models | Rolling back to a previous model version | I |
| 7 | Serving through an API | A model behind a REST endpoint | E |
| 8 | Serving through an API | Latency budget and model size | I |
| 9 | Serving through an API | Shadow deployment / canary release | A |
| 10 | Input contracts | What an input schema guarantees | I |
| 11 | Input contracts | A breaking change in the input format (scenario) | I |
| 12 | Input contracts | Validating feature ranges at the API boundary | I |
| 13 | Handling bad inputs | Rejecting vs defaulting a missing field | I |
| 14 | Handling bad inputs | Fallback behaviour when the model fails | A |
| 15 | Handling bad inputs | Logging bad inputs for investigation | A |

### 21. Monitoring, Drift, and Maintenance — Advanced · planned E 3 / I 8 / A 4
| # | Sub-topic | What the question tests | L |
|---|---|---|---|
| 1 | Monitoring inputs and predictions | Why to monitor when labels arrive late | I |
| 2 | Monitoring inputs and predictions | Tracking the prediction distribution | E |
| 3 | Monitoring inputs and predictions | Operational metrics (latency, errors) vs model metrics | E |
| 4 | Data and concept drift | Data drift definition | E |
| 5 | Data and concept drift | Concept drift definition (the relationship changes) | I |
| 6 | Data and concept drift | Telling drift types apart in a scenario | A |
| 7 | Performance decay | Why a model's accuracy decays over time | I |
| 8 | Performance decay | Feedback loops: the model's own decisions shape future data | A |
| 9 | Performance decay | Seasonal dips vs real decay | I |
| 10 | Alerts and thresholds | Setting a drift alert threshold | I |
| 11 | Alerts and thresholds | Alerting on sustained shifts rather than single spikes | I |
| 12 | Alerts and thresholds | Who owns an alert and what they do next | I |
| 13 | Retraining triggers | Scheduled vs triggered retraining | I |
| 14 | Retraining triggers | Validating a retrained model before swapping it in | A |
| 15 | Retraining triggers | Retraining on drifted data that includes bad labels | A |

### 22. Responsible, Private, and Secure ML — Advanced · planned E 4 / I 7 / A 4
| # | Sub-topic | What the question tests | L |
|---|---|---|---|
| 1 | Bias and fairness | How biased training data produces biased models | E |
| 2 | Bias and fairness | Removing a sensitive column isn't enough (proxy features) | I |
| 3 | Bias and fairness | Fairness metrics can conflict (scenario) | A |
| 4 | Privacy and data handling | Minimising personal data collected | E |
| 5 | Privacy and data handling | Anonymisation vs pseudonymisation | I |
| 6 | Privacy and data handling | Models can memorise and leak training data | A |
| 7 | Adversarial attacks | What an adversarial example is | I |
| 8 | Adversarial attacks | Data poisoning | I |
| 9 | Adversarial attacks | Prompt injection in LLM apps | A |
| 10 | Human oversight | Human-in-the-loop for high-stakes decisions | E |
| 11 | Human oversight | Automation bias (over-trusting the model) | I |
| 12 | Human oversight | Designing an appeal path for affected users | I |
| 13 | Model cards | What a model card documents | E |
| 14 | Model cards | Stating intended use and known limitations | I |
| 15 | Model cards | When the documentation should say "do not use" (scenario) | A |

---

## Totals

| Track | Topics | Questions | Easy | Intermediate | Advanced |
|---|---:|---:|---:|---:|---:|
| ML Foundations | 5 | 75 | 32 | 33 | 10 |
| Supervised Learning | 6 | 90 | 22 | 49 | 19 |
| Unsupervised Learning | 3 | 45 | 13 | 23 | 9 |
| Deep Learning | 5 | 75 | 15 | 40 | 20 |
| Production Machine Learning | 3 | 45 | 11 | 23 | 11 |
| **All** | **22** | **330** | **93** | **168** | **69** |

The levels are judged per question, not set by quota. They follow the topics' tiers: Foundation topics are about 43% Easy, and Advanced topics about 20% Easy.

## Drafting workflow (after approval)

1. **Draft per track,** one topic at a time: question, 4 options, correct answer, hint, explanation, level, marks and time.
2. **Self-review against the six rules,** especially option-length balance and distractor plausibility, and the ownership map for duplicates.
3. **Load into the dev DB** as Pending, linked to the topic via `question_topic` and to the Machine Learning subject. Review, then approve to Active. Verify the cert ladder becomes earnable: each topic needs enough Active trivia to reach 70% coverage.
4. **Sync to `04-questions.seed.json`.**
