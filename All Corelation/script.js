document.addEventListener("DOMContentLoaded", function () {
  // DOM Elements
  const correlationTypeSelect = document.getElementById("correlation-type");
  const variableCountSelect = document.getElementById("variable-count");
  const dataInputsDiv = document.getElementById("data-inputs");
  const calculateBtn = document.getElementById("calculate-btn");
  const resetBtn = document.getElementById("reset-btn");
  const calculationStepsDiv = document.getElementById("calculation-steps");
  const hypothesisTestingDiv = document.getElementById("hypothesis-testing");
  const correlationValueDiv = document.getElementById("correlation-value");
  const methodBadge = document.getElementById("method-badge");
  const sampleSizeBadge = document.getElementById("sample-size-badge");
  const significanceIndicator = document.getElementById(
    "significance-indicator"
  );
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabContents = document.querySelectorAll(".tab-content");
  const chartCanvas = document.getElementById("correlation-chart");
  const chartLegend = document.getElementById("chart-legend");

  let correlationChart = null;
  let currentCorrelationType = "";
  let currentVariables = [];
  let currentData = {};

  // Initialize the app
  initApp();

  function initApp() {
    updateDataInputs();
    setupEventListeners();
  }

  function setupEventListeners() {
    correlationTypeSelect.addEventListener("change", updateDataInputs);
    variableCountSelect.addEventListener("change", updateDataInputs);
    calculateBtn.addEventListener("click", calculateCorrelation);
    resetBtn.addEventListener("click", resetCalculator);

    tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const tabId = button.getAttribute("data-tab");
        switchTab(tabId);
      });
    });
  }

  function updateDataInputs() {
    const correlationType = correlationTypeSelect.value;
    const variableCount = parseInt(variableCountSelect.value);

    dataInputsDiv.innerHTML = "";
    currentVariables = [];

    if (correlationType === "pointbiserial") {
      createBinaryVariableInput("X (Binary)");
      createContinuousVariableInput("Y (Continuous)");
      currentVariables = ["X (Binary)", "Y (Continuous)"];
    } else if (correlationType === "cramersv") {
      createCategoricalVariableInput("Variable 1");
      createCategoricalVariableInput("Variable 2");
      currentVariables = ["Variable 1", "Variable 2"];
    } else {
      for (let i = 0; i < variableCount; i++) {
        const varName = String.fromCharCode(88 + i); // X, Y, Z
        createContinuousVariableInput(varName);
        currentVariables.push(varName);
      }
    }

    currentCorrelationType = correlationType;
  }

  function createContinuousVariableInput(label) {
    const group = document.createElement("div");
    group.className = "variable-input-group";

    const inputId = `input-${label.replace(/\s+/g, "-").toLowerCase()}`;

    group.innerHTML = `
            <label for="${inputId}">${label} (comma-separated values)</label>
            <input type="text" id="${inputId}" class="form-input" 
                   placeholder="e.g., 1, 2, 3, 4, 5" data-variable="${label}">
        `;

    dataInputsDiv.appendChild(group);
  }

  function createBinaryVariableInput(label) {
    const group = document.createElement("div");
    group.className = "variable-input-group";

    const inputId = `input-${label.replace(/\s+/g, "-").toLowerCase()}`;

    group.innerHTML = `
            <label for="${inputId}">${label} (comma-separated 0s and 1s)</label>
            <input type="text" id="${inputId}" class="form-input" 
                   placeholder="e.g., 0, 0, 1, 1" data-variable="${label}">
        `;

    dataInputsDiv.appendChild(group);
  }

  function createCategoricalVariableInput(label) {
    const group = document.createElement("div");
    group.className = "variable-input-group";

    const inputId = `input-${label.replace(/\s+/g, "-").toLowerCase()}`;

    group.innerHTML = `
            <label for="${inputId}">${label} (comma-separated categories)</label>
            <input type="text" id="${inputId}" class="form-input" 
                   placeholder="e.g., A, A, B, B, C" data-variable="${label}">
        `;

    dataInputsDiv.appendChild(group);
  }

  function calculateCorrelation() {
    // Parse input data
    const inputs = Array.from(dataInputsDiv.querySelectorAll("input"));
    currentData = {};

    inputs.forEach((input) => {
      const variableName = input.dataset.variable;
      const values = input.value.split(",").map((item) => item.trim());

      if (
        currentCorrelationType === "pointbiserial" &&
        variableName.includes("Binary")
      ) {
        currentData[variableName] = values.map((val) => {
          const num = parseInt(val);
          if (num !== 0 && num !== 1) {
            showError(
              `Binary variable ${variableName} must contain only 0s and 1s`
            );
            throw new Error("Invalid binary data");
          }
          return num;
        });
      } else if (currentCorrelationType === "cramersv") {
        currentData[variableName] = values;
      } else {
        currentData[variableName] = values.map((val) => {
          const num = parseFloat(val);
          if (isNaN(num)) {
            showError(`Invalid number in ${variableName}`);
            throw new Error("Invalid numeric data");
          }
          return num;
        });
      }
    });

    // Check for equal length
    const lengths = Object.values(currentData).map((arr) => arr.length);
    if (new Set(lengths).size !== 1) {
      showError("All variables must have the same number of values");
      return;
    }

    const sampleSize = lengths[0];
    if (sampleSize < 3) {
      showError("At least 3 data points are required");
      return;
    }

    // Clear previous results
    clearResults();

    // Update UI with current parameters
    updateMethodBadge();
    sampleSizeBadge.textContent = `n=${sampleSize}`;

    // Calculate based on selected correlation type
    let correlationResult;
    try {
      switch (currentCorrelationType) {
        case "pearson":
          correlationResult = calculatePearson(currentData);
          break;
        case "spearman":
          correlationResult = calculateSpearman(currentData);
          break;
        case "pointbiserial":
          correlationResult = calculatePointBiserial(currentData);
          break;
        case "cramersv":
          correlationResult = calculateCramersV(currentData);
          break;
        case "kendall":
          correlationResult = calculateKendall(currentData);
          break;
      }

      // Display results
      displayCorrelationResult(correlationResult);
      performHypothesisTest(correlationResult);
      updateChart(currentData, correlationResult);

      // Switch to results tab
      switchTab("results");
    } catch (error) {
      showError(error.message);
    }
  }

  function calculatePearson(data) {
    const varNames = Object.keys(data);
    const x = data[varNames[0]];
    const y = data[varNames[1]];
    const n = x.length;

    // Calculation steps
    addStep(
      "Step 1: Calculate Means",
      `
            <p>Mean of X = ${mean(x).toFixed(4)}</p>
            <p>Mean of Y = ${mean(y).toFixed(4)}</p>
        `
    );

    addStep(
      "Step 2: Calculate Covariance",
      `
            <p>Cov(X,Y) = Σ[(Xᵢ - X̄)(Yᵢ - Ȳ)] / n = ${covariance(x, y).toFixed(
              4
            )}</p>
        `
    );

    addStep(
      "Step 3: Calculate Standard Deviations",
      `
            <p>SD of X = ${standardDeviation(x).toFixed(4)}</p>
            <p>SD of Y = ${standardDeviation(y).toFixed(4)}</p>
        `
    );

    const r = covariance(x, y) / (standardDeviation(x) * standardDeviation(y));

    addStep(
      "Step 4: Calculate Pearson's r",
      `
            <p>r = Cov(X,Y) / (SD_X × SD_Y) = ${r.toFixed(4)}</p>
        `
    );

    return {
      type: "pearson",
      value: r,
      n: n,
      variables: varNames,
      calculationSteps: calculationStepsDiv.innerHTML,
    };
  }

  function calculateSpearman(data) {
    const varNames = Object.keys(data);
    const x = data[varNames[0]];
    const y = data[varNames[1]];
    const n = x.length;

    addStep(
      "Step 1: Rank the Data",
      `
            <p>X Ranks: [${rankData(x).join(", ")}]</p>
            <p>Y Ranks: [${rankData(y).join(", ")}]</p>
        `
    );

    let dSquaredSum = 0;
    let differencesHtml = "";
    const xRanks = rankData(x);
    const yRanks = rankData(y);

    for (let i = 0; i < n; i++) {
      const d = xRanks[i] - yRanks[i];
      dSquaredSum += d * d;
      differencesHtml += `<tr><td>${i + 1}</td><td>${d}</td><td>${
        d * d
      }</td></tr>`;
    }

    addStep(
      "Step 2: Calculate Rank Differences",
      `
            <table>
                <thead>
                    <tr><th>Pair</th><th>d</th><th>d²</th></tr>
                </thead>
                <tbody>
                    ${differencesHtml}
                </tbody>
                <tfoot>
                    <tr><th>Sum</th><th></th><th>${dSquaredSum}</th></tr>
                </tfoot>
            </table>
        `
    );

    const rho = 1 - (6 * dSquaredSum) / (n * (n * n - 1));

    addStep(
      "Step 3: Calculate Spearman's ρ",
      `
            <p>ρ = 1 - [6 × Σd² / (n(n² - 1))] = ${rho.toFixed(4)}</p>
        `
    );

    return {
      type: "spearman",
      value: rho,
      n: n,
      variables: varNames,
      calculationSteps: calculationStepsDiv.innerHTML,
    };
  }

  function calculatePointBiserial(data) {
    const x = data["X (Binary)"];
    const y = data["Y (Continuous)"];
    const n = x.length;

    addStep(
      "Step 1: Group Continuous Variable by Binary Categories",
      `
            <p>Group 0 (X=0): [${y.filter((_, i) => x[i] === 0).join(", ")}]</p>
            <p>Group 1 (X=1): [${y.filter((_, i) => x[i] === 1).join(", ")}]</p>
        `
    );

    const group0 = y.filter((_, i) => x[i] === 0);
    const group1 = y.filter((_, i) => x[i] === 1);
    const mean0 = mean(group0);
    const mean1 = mean(group1);

    addStep(
      "Step 2: Calculate Group Means",
      `
            <p>Mean of Y when X=0: ${mean0.toFixed(4)}</p>
            <p>Mean of Y when X=1: ${mean1.toFixed(4)}</p>
        `
    );

    const sd0 = standardDeviation(group0);
    const sd1 = standardDeviation(group1);
    const pooledSD = Math.sqrt(
      ((group0.length - 1) * sd0 * sd0 + (group1.length - 1) * sd1 * sd1) /
        (group0.length + group1.length - 2)
    );

    addStep(
      "Step 3: Calculate Pooled Standard Deviation",
      `
            <p>Pooled SD = √[((n₀-1)s₀² + (n₁-1)s₁²) / (n₀ + n₁ - 2)] = ${pooledSD.toFixed(
              4
            )}</p>
        `
    );

    const r_pb =
      ((mean1 - mean0) / pooledSD) *
      Math.sqrt((group0.length * group1.length) / (n * (n - 1)));

    addStep(
      "Step 4: Calculate Point-Biserial Correlation",
      `
            <p>r_pb = [(M₁ - M₀) / SD_pooled] × √[(n₀ × n₁) / (n(n-1))] = ${r_pb.toFixed(
              4
            )}</p>
        `
    );

    return {
      type: "pointbiserial",
      value: r_pb,
      n: n,
      variables: ["X (Binary)", "Y (Continuous)"],
      calculationSteps: calculationStepsDiv.innerHTML,
    };
  }

  function calculateCramersV(data) {
    const var1 = data["Variable 1"];
    const var2 = data["Variable 2"];
    const n = var1.length;

    addStep("Step 1: Create Contingency Table", "");

    const categories1 = [...new Set(var1)];
    const categories2 = [...new Set(var2)];

    // Initialize contingency table
    const contingencyTable = {};
    categories1.forEach((cat1) => {
      contingencyTable[cat1] = {};
      categories2.forEach((cat2) => {
        contingencyTable[cat1][cat2] = 0;
      });
    });

    // Fill contingency table
    for (let i = 0; i < n; i++) {
      contingencyTable[var1[i]][var2[i]]++;
    }

    // Calculate row and column totals
    const rowTotals = {};
    const colTotals = {};
    categories1.forEach((cat1) => {
      rowTotals[cat1] = Object.values(contingencyTable[cat1]).reduce(
        (a, b) => a + b,
        0
      );
    });
    categories2.forEach((cat2) => {
      colTotals[cat2] = categories1.reduce(
        (sum, cat1) => sum + contingencyTable[cat1][cat2],
        0
      );
    });
    const grandTotal = n;

    // Display contingency table
    let tableHTML = "<table><tr><th></th>";
    categories2.forEach((cat2) => {
      tableHTML += `<th>${cat2}</th>`;
    });
    tableHTML += "<th>Total</th></tr>";

    categories1.forEach((cat1) => {
      tableHTML += `<tr><th>${cat1}</th>`;
      categories2.forEach((cat2) => {
        tableHTML += `<td>${contingencyTable[cat1][cat2]}</td>`;
      });
      tableHTML += `<td>${rowTotals[cat1]}</td></tr>`;
    });

    tableHTML += "<tr><th>Total</th>";
    categories2.forEach((cat2) => {
      tableHTML += `<td>${colTotals[cat2]}</td>`;
    });
    tableHTML += `<td>${grandTotal}</td></tr></table>`;

    // Update the step with the table
    calculationStepsDiv.lastElementChild.innerHTML += tableHTML;

    addStep("Step 2: Calculate Chi-Square Statistic", "");

    let chiSquare = 0;
    let chiSquareCalc = "";

    categories1.forEach((cat1) => {
      categories2.forEach((cat2) => {
        const observed = contingencyTable[cat1][cat2];
        const expected = (rowTotals[cat1] * colTotals[cat2]) / grandTotal;
        const cellChi = Math.pow(observed - expected, 2) / expected;
        chiSquare += cellChi;

        chiSquareCalc += `<tr>
                    <td>${cat1},${cat2}</td>
                    <td>${observed}</td>
                    <td>${expected.toFixed(2)}</td>
                    <td>${cellChi.toFixed(4)}</td>
                </tr>`;
      });
    });

    calculationStepsDiv.lastElementChild.innerHTML += `
            <table>
                <thead>
                    <tr>
                        <th>Cell</th>
                        <th>Observed</th>
                        <th>Expected</th>
                        <th>(O-E)²/E</th>
                    </tr>
                </thead>
                <tbody>
                    ${chiSquareCalc}
                </tbody>
                <tfoot>
                    <tr>
                        <th colspan="3">Total (χ²)</th>
                        <th>${chiSquare.toFixed(4)}</th>
                    </tr>
                </tfoot>
            </table>
        `;

    addStep("Step 3: Calculate Cramér's V", "");

    const k = Math.min(categories1.length, categories2.length);
    const v = Math.sqrt(chiSquare / (grandTotal * (k - 1)));

    calculationStepsDiv.lastElementChild.innerHTML += `
            <p>V = √(χ² / (n × (k - 1))) = √(${chiSquare.toFixed(
              4
            )} / (${grandTotal} × ${k - 1})) = ${v.toFixed(4)}</p>
        `;

    return {
      type: "cramersv",
      value: v,
      n: n,
      variables: ["Variable 1", "Variable 2"],
      chiSquare: chiSquare,
      df: (categories1.length - 1) * (categories2.length - 1),
      calculationSteps: calculationStepsDiv.innerHTML,
    };
  }

  function calculateKendall(data) {
    const varNames = Object.keys(data);
    const x = data[varNames[0]];
    const y = data[varNames[1]];
    const n = x.length;

    addStep("Step 1: List All Possible Pairs", "");

    let concordant = 0;
    let discordant = 0;
    let pairsHtml = "";

    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const xDirection = Math.sign(x[j] - x[i]);
        const yDirection = Math.sign(y[j] - y[i]);
        const pairType = xDirection * yDirection;

        let typeStr = "";
        if (pairType > 0) {
          concordant++;
          typeStr = "Concordant";
        } else if (pairType < 0) {
          discordant++;
          typeStr = "Discordant";
        } else {
          typeStr = "Tie (ignored)";
        }

        pairsHtml += `<tr>
                    <td>(${i + 1},${j + 1})</td>
                    <td>${xDirection}</td>
                    <td>${yDirection}</td>
                    <td>${typeStr}</td>
                </tr>`;
      }
    }

    calculationStepsDiv.lastElementChild.innerHTML += `
            <table>
                <thead>
                    <tr>
                        <th>Pair</th>
                        <th>X Direction</th>
                        <th>Y Direction</th>
                        <th>Type</th>
                    </tr>
                </thead>
                <tbody>
                    ${pairsHtml}
                </tbody>
            </table>
            <p>Total Concordant Pairs (C): ${concordant}</p>
            <p>Total Discordant Pairs (D): ${discordant}</p>
        `;

    const tau = (concordant - discordant) / (0.5 * n * (n - 1));

    addStep(
      "Step 2: Calculate Kendall's τ",
      `
            <p>τ = (C - D) / [n(n-1)/2] = (${concordant} - ${discordant}) / ${
        0.5 * n * (n - 1)
      } = ${tau.toFixed(4)}</p>
        `
    );

    return {
      type: "kendall",
      value: tau,
      n: n,
      variables: varNames,
      calculationSteps: calculationStepsDiv.innerHTML,
    };
  }

  function performHypothesisTest(result) {
    let testStatistic, df, criticalValue, pValue, testName;
    const alpha = 0.05;

    hypothesisTestingDiv.innerHTML = "";

    if (result.type === "pearson" || result.type === "pointbiserial") {
      testName = "t-test";
      df = result.n - 2;
      testStatistic =
        result.value * Math.sqrt(df / (1 - result.value * result.value));
      criticalValue = getTCriticalValue(df);
      pValue = 2 * (1 - tDistributionCDF(Math.abs(testStatistic), df));
    } else if (result.type === "spearman") {
      testName = "Spearman test";
      if (result.n > 10) {
        // Normal approximation for large n
        testStatistic = result.value * Math.sqrt(result.n - 1);
        criticalValue = 1.96; // For alpha=0.05, two-tailed
        pValue = 2 * (1 - normalCDF(Math.abs(testStatistic)));
      } else {
        // Exact test needed for small n
        const testDiv = document.createElement("div");
        testDiv.className = "test-result";
        testDiv.innerHTML = `
                    <p><strong>Note:</strong> For Spearman's ρ with n ≤ 10, exact tables are needed for hypothesis testing.</p>
                    <p>The normal approximation is not reliable for small sample sizes.</p>
                `;
        hypothesisTestingDiv.appendChild(testDiv);
        return;
      }
    } else if (result.type === "kendall") {
      testName = "Kendall test";
      if (result.n > 10) {
        // Normal approximation for large n
        testStatistic =
          result.value *
          Math.sqrt((9 * result.n * (result.n - 1)) / (2 * (2 * result.n + 5)));
        criticalValue = 1.96; // For alpha=0.05, two-tailed
        pValue = 2 * (1 - normalCDF(Math.abs(testStatistic)));
      } else {
        // Exact test needed for small n
        const testDiv = document.createElement("div");
        testDiv.className = "test-result";
        testDiv.innerHTML = `
                    <p><strong>Note:</strong> For Kendall's τ with n ≤ 10, exact tables are needed for hypothesis testing.</p>
                    <p>The normal approximation is not reliable for small sample sizes.</p>
                `;
        hypothesisTestingDiv.appendChild(testDiv);
        return;
      }
    } else if (result.type === "cramersv") {
      testName = "Chi-square test";
      df = result.df;
      testStatistic = result.chiSquare;
      criticalValue = getChiSquareCriticalValue(df);
      pValue = 1 - chiSquareCDF(testStatistic, df);
    }

    const isSignificant = pValue < alpha;

    const testDiv = document.createElement("div");
    testDiv.className = `test-result ${
      isSignificant ? "significant" : "not-significant"
    }`;

    testDiv.innerHTML = `
            <h4>${testName} Results</h4>
            <p><strong>Null Hypothesis (H₀):</strong> No ${
              result.type === "cramersv" ? "association" : "correlation"
            } exists</p>
            <p><strong>Alternative Hypothesis (H₁):</strong> ${
              result.type === "cramersv" ? "Association" : "Correlation"
            } exists</p>
            ${
              testStatistic !== undefined
                ? `<p><strong>Test Statistic:</strong> ${testStatistic.toFixed(
                    4
                  )}</p>`
                : ""
            }
            ${
              df !== undefined
                ? `<p><strong>Degrees of Freedom:</strong> ${df}</p>`
                : ""
            }
            ${
              criticalValue !== undefined
                ? `<p><strong>Critical Value (α=${alpha}):</strong> ${
                    result.type === "cramersv" ? ">" : "±"
                  }${criticalValue.toFixed(4)}</p>`
                : ""
            }
            ${
              pValue !== undefined
                ? `<p><strong>p-value:</strong> ${pValue.toFixed(4)}</p>`
                : ""
            }
            <p><strong>Conclusion:</strong> ${
              isSignificant
                ? '<span class="significant-text">Reject H₀ (Significant ' +
                  (result.type === "cramersv" ? "association" : "correlation") +
                  ")</span>"
                : '<span class="not-significant-text">Fail to reject H₀ (No significant ' +
                  (result.type === "cramersv" ? "association" : "correlation") +
                  ")</span>"
            }</p>
        `;

    hypothesisTestingDiv.appendChild(testDiv);

    // Update significance indicator
    significanceIndicator.className = `significance-indicator ${
      isSignificant ? "significant" : "not-significant"
    }`;
    significanceIndicator.querySelector(".indicator-text").textContent =
      isSignificant
        ? "Statistically significant"
        : "Not statistically significant";
  }

  function displayCorrelationResult(result) {
    const correlationNames = {
      pearson: "Pearson's r",
      spearman: "Spearman's ρ",
      pointbiserial: "Point-Biserial r",
      cramersv: "Cramér's V",
      kendall: "Kendall's τ",
    };

    const valueElement = correlationValueDiv.querySelector(".value");
    const interpretationElement =
      correlationValueDiv.querySelector(".interpretation");

    valueElement.textContent = result.value.toFixed(4);
    valueElement.style.color = getCorrelationColor(result.value, result.type);

    interpretationElement.textContent = interpretCorrelation(
      result.value,
      result.type
    );

    methodBadge.textContent = correlationNames[result.type];
  }

  function updateChart(data, result) {
    if (chartCanvas) {
      if (correlationChart) {
        correlationChart.destroy();
      }

      const ctx = chartCanvas.getContext("2d");

      if (
        result.type === "pearson" ||
        result.type === "spearman" ||
        result.type === "pointbiserial"
      ) {
        // Scatter plot for continuous data
        const varNames = Object.keys(data);
        const xData = data[varNames[0]];
        const yData = data[varNames[1]];

        const pointBackgroundColors = [];
        if (result.type === "pointbiserial") {
          // Color points by binary category
          const binaryData = data["X (Binary)"];
          binaryData.forEach((val) => {
            pointBackgroundColors.push(val === 1 ? "#4361ee" : "#3a0ca3");
          });
        } else {
          pointBackgroundColors.push("#4361ee");
        }

        correlationChart = new Chart(ctx, {
          type: "scatter",
          data: {
            datasets: [
              {
                label: `${varNames[0]} vs ${varNames[1]}`,
                data: xData.map((x, i) => ({ x, y: yData[i] })),
                backgroundColor: pointBackgroundColors,
                borderColor: "#fff",
                borderWidth: 1,
                pointRadius: 6,
                pointHoverRadius: 8,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                title: {
                  display: true,
                  text: varNames[0],
                },
              },
              y: {
                title: {
                  display: true,
                  text: varNames[1],
                },
              },
            },
            plugins: {
              title: {
                display: true,
                text: `${
                  correlationNames[result.type]
                } = ${result.value.toFixed(4)}`,
                font: {
                  size: 16,
                },
              },
              tooltip: {
                callbacks: {
                  label: function (context) {
                    return `${varNames[0]}: ${context.parsed.x}, ${varNames[1]}: ${context.parsed.y}`;
                  },
                },
              },
            },
          },
        });

        // Update legend for point-biserial
        if (result.type === "pointbiserial") {
          chartLegend.innerHTML = `
                        <div class="legend-item">
                            <span class="legend-color" style="background-color: #3a0ca3"></span>
                            <span class="legend-text">X = 0</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-color" style="background-color: #4361ee"></span>
                            <span class="legend-text">X = 1</span>
                        </div>
                    `;
        } else {
          chartLegend.innerHTML = "";
        }
      } else if (result.type === "cramersv") {
        // Bar chart for categorical data
        const var1 = data["Variable 1"];
        const var2 = data["Variable 2"];
        const categories1 = [...new Set(var1)];
        const categories2 = [...new Set(var2)];

        // Create stacked bar chart data
        const datasets = categories2.map((cat2, i) => {
          const backgroundColor = `hsl(${
            (i * 360) / categories2.length
          }, 70%, 60%)`;
          return {
            label: cat2,
            data: categories1.map((cat1) => {
              return var1.reduce(
                (count, val, idx) =>
                  val === cat1 && var2[idx] === cat2 ? count + 1 : count,
                0
              );
            }),
            backgroundColor: backgroundColor,
          };
        });

        correlationChart = new Chart(ctx, {
          type: "bar",
          data: {
            labels: categories1,
            datasets: datasets,
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                stacked: true,
                title: {
                  display: true,
                  text: "Variable 1",
                },
              },
              y: {
                stacked: true,
                title: {
                  display: true,
                  text: "Count",
                },
              },
            },
            plugins: {
              title: {
                display: true,
                text: `Cramér's V = ${result.value.toFixed(4)}`,
                font: {
                  size: 16,
                },
              },
              tooltip: {
                callbacks: {
                  label: function (context) {
                    return `${context.dataset.label}: ${context.raw}`;
                  },
                },
              },
            },
          },
        });
      }
    }
  }

  function switchTab(tabId) {
    tabButtons.forEach((button) => {
      button.classList.toggle(
        "active",
        button.getAttribute("data-tab") === tabId
      );
    });

    tabContents.forEach((content) => {
      content.classList.toggle("active", content.id === tabId);
    });
  }

  function resetCalculator() {
    correlationTypeSelect.value = "pearson";
    variableCountSelect.value = "2";
    updateDataInputs();
    clearResults();

    if (correlationChart) {
      correlationChart.destroy();
      correlationChart = null;
    }

    chartLegend.innerHTML = "";
    switchTab("results");
  }

  function clearResults() {
    calculationStepsDiv.innerHTML =
      '<p class="placeholder-text">Detailed calculation steps will appear here</p>';
    hypothesisTestingDiv.innerHTML =
      '<p class="placeholder-text">Results will appear here after calculation</p>';
    correlationValueDiv.querySelector(".value").textContent = "-";
    correlationValueDiv.querySelector(".interpretation").textContent =
      "Select data and calculate";
    significanceIndicator.className = "significance-indicator";
    significanceIndicator.querySelector(".indicator-text").textContent =
      "Not calculated";
    methodBadge.textContent = "Pearson's r";
    sampleSizeBadge.textContent = "n=0";
  }

  function showError(message) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "error-message";
    errorDiv.textContent = message;

    // Remove any existing error messages
    document.querySelectorAll(".error-message").forEach((el) => el.remove());

    // Add new error message
    document.body.appendChild(errorDiv);

    // Remove after 3 seconds
    setTimeout(() => {
      errorDiv.remove();
    }, 3000);
  }

  function updateMethodBadge() {
    const methodNames = {
      pearson: "Pearson's r",
      spearman: "Spearman's ρ",
      pointbiserial: "Point-Biserial",
      cramersv: "Cramér's V",
      kendall: "Kendall's τ",
    };
    methodBadge.textContent = methodNames[currentCorrelationType];
  }

  function addStep(title, content) {
    const stepDiv = document.createElement("div");
    stepDiv.className = "step";

    stepDiv.innerHTML = `
            <div class="step-title">${title}</div>
            <div class="step-content">${content}</div>
        `;

    // If this is the first step, replace the placeholder
    if (
      calculationStepsDiv.firstElementChild.classList.contains(
        "placeholder-text"
      )
    ) {
      calculationStepsDiv.innerHTML = "";
    }

    calculationStepsDiv.appendChild(stepDiv);
  }

  // Helper mathematical functions
  function mean(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  function standardDeviation(arr) {
    const arrMean = mean(arr);
    const squaredDiffs = arr.map((val) => Math.pow(val - arrMean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / arr.length);
  }

  function covariance(x, y) {
    const xMean = mean(x);
    const yMean = mean(y);
    let cov = 0;

    for (let i = 0; i < x.length; i++) {
      cov += (x[i] - xMean) * (y[i] - yMean);
    }

    return cov / x.length;
  }

  function rankData(arr) {
    // Create array of objects with original values and indices
    const indexedArr = arr.map((val, idx) => ({ val, idx }));

    // Sort by value
    indexedArr.sort((a, b) => a.val - b.val);

    // Assign ranks, handling ties
    const ranks = new Array(arr.length);
    for (let i = 0; i < indexedArr.length; i++) {
      let j = i;
      while (
        j < indexedArr.length - 1 &&
        indexedArr[j + 1].val === indexedArr[j].val
      ) {
        j++;
      }

      // Average rank for tied values
      const avgRank = (i + j + 2) / 2;
      for (let k = i; k <= j; k++) {
        ranks[indexedArr[k].idx] = avgRank;
      }

      i = j;
    }

    return ranks;
  }

  function getTCriticalValue(df) {
    // Simplified critical values for α=0.05, two-tailed
    const tTable = {
      1: 12.706,
      2: 4.303,
      3: 3.182,
      4: 2.776,
      5: 2.571,
      6: 2.447,
      7: 2.365,
      8: 2.306,
      9: 2.262,
      10: 2.228,
      20: 2.086,
      30: 2.042,
      40: 2.021,
      50: 2.009,
      100: 1.984,
    };

    if (df <= 10) return tTable[df];
    if (df <= 20)
      return tTable[10] + ((tTable[20] - tTable[10]) * (df - 10)) / 10;
    if (df <= 30)
      return tTable[20] + ((tTable[30] - tTable[20]) * (df - 20)) / 10;
    if (df <= 40)
      return tTable[30] + ((tTable[40] - tTable[30]) * (df - 30)) / 10;
    if (df <= 50)
      return tTable[40] + ((tTable[50] - tTable[40]) * (df - 40)) / 10;
    if (df <= 100)
      return tTable[50] + ((tTable[100] - tTable[50]) * (df - 50)) / 50;
    return 1.96; // Approximate with normal for large df
  }

  function getChiSquareCriticalValue(df) {
    // Simplified critical values for α=0.05
    const chiSquareTable = {
      1: 3.841,
      2: 5.991,
      3: 7.815,
      4: 9.488,
      5: 11.07,
      6: 12.592,
      7: 14.067,
      8: 15.507,
      9: 16.919,
      10: 18.307,
    };
    return chiSquareTable[df] || 0;
  }

  function normalCDF(z) {
    // Approximation of standard normal CDF
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp((-z * z) / 2);
    let probability =
      d *
      t *
      (0.3193815 +
        t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    if (z > 0) probability = 1 - probability;
    return probability;
  }

  function tDistributionCDF(t, df) {
    // Approximation of Student's t-distribution CDF
    const x = df / (df + t * t);
    const p = 0.5 * incompleteBeta(x, df / 2, 0.5);
    return t < 0 ? p : 1 - p;
  }

  function incompleteBeta(x, a, b) {
    // Continued fraction approximation for incomplete beta function
    const eps = 1e-10;
    let aplusb = a + b;
    let aplus1 = a + 1;
    let aminus1 = a - 1;
    let c = 1;
    let d = 1 - (aplusb * x) / aplus1;
    if (Math.abs(d) < eps) d = eps;
    d = 1 / d;
    let h = d;

    for (let m = 1; m <= 100; m++) {
      const m2 = 2 * m;
      let aa = (m * (b - m) * x) / ((aminus1 + m2) * (a + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < eps) d = eps;
      c = 1 + aa / c;
      if (Math.abs(c) < eps) c = eps;
      d = 1 / d;
      h *= d * c;

      aa = (-(a + m) * (aplusb + m) * x) / ((a + m2) * (aplus1 + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < eps) d = eps;
      c = 1 + aa / c;
      if (Math.abs(c) < eps) c = eps;
      d = 1 / d;
      const del = d * c;
      h *= del;

      if (Math.abs(del - 1) < eps) break;
    }

    return (h * Math.pow(x, a) * Math.pow(1 - x, b)) / a / beta(a, b);
  }

  function beta(a, b) {
    // Beta function
    return Math.exp(logGamma(a) + logGamma(b) - logGamma(a + b));
  }

  function logGamma(z) {
    // Natural log of the gamma function
    if (z < 0) return 0;
    if (z < 9) return logGamma(z + 1) - Math.log(z);

    const l = 1 / (z * z);
    return (
      (z - 0.5) * Math.log(z) -
      z +
      0.9189385332046727 +
      (((-0.000595238095238 * l + 0.000793650793651) * l - 0.002777777777778) *
        l +
        0.083333333333333) /
        z
    );
  }

  function chiSquareCDF(x, df) {
    // Chi-square distribution CDF
    return incompleteGammaP(df / 2, x / 2);
  }

  function incompleteGammaP(a, x) {
    // Incomplete gamma function P(a,x)
    if (x < a + 1) {
      return seriesIncompleteGamma(a, x);
    } else {
      return 1 - continuedFractionIncompleteGamma(a, x);
    }
  }

  function seriesIncompleteGamma(a, x) {
    // Series representation of incomplete gamma
    const eps = 1e-10;
    let sum = 1 / a;
    let term = 1 / a;
    let n = 1;

    while (term > eps * sum) {
      term *= x / (a + n);
      sum += term;
      n++;
    }

    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }

  function continuedFractionIncompleteGamma(a, x) {
    // Continued fraction representation of incomplete gamma
    const eps = 1e-10;
    let b = x + 1 - a;
    let c = 1 / eps;
    let d = 1 / b;
    let h = d;

    for (let i = 1; i <= 100; i++) {
      const an = -i * (i - a);
      b += 2;
      d = an * d + b;
      if (Math.abs(d) < eps) d = eps;
      c = b + an / c;
      if (Math.abs(c) < eps) c = eps;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < eps) break;
    }

    return h * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }

  function interpretCorrelation(value, type) {
    const absValue = Math.abs(value);
    let interpretation = "";

    if (type === "cramersv") {
      if (absValue >= 0.9) return "Very strong association";
      if (absValue >= 0.7) return "Strong association";
      if (absValue >= 0.5) return "Moderate association";
      if (absValue >= 0.3) return "Weak association";
      return "Very weak or no association";
    } else {
      if (absValue >= 0.9) return "Very strong correlation";
      if (absValue >= 0.7) return "Strong correlation";
      if (absValue >= 0.5) return "Moderate correlation";
      if (absValue >= 0.3) return "Weak correlation";
      return "Very weak or no correlation";
    }
  }

  function getCorrelationColor(value, type) {
    const absValue = Math.abs(value);

    if (type === "cramersv") {
      if (absValue >= 0.7) return "#2ecc71"; // Strong (green)
      if (absValue >= 0.5) return "#f39c12"; // Moderate (orange)
      return "#e74c3c"; // Weak (red)
    } else {
      if (absValue >= 0.7) return value > 0 ? "#2ecc71" : "#e74c3c"; // Strong (green/red)
      if (absValue >= 0.5) return value > 0 ? "#f39c12" : "#3498db"; // Moderate (orange/blue)
      return "#95a5a6"; // Weak (gray)
    }
  }
});
