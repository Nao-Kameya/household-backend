require("dotenv").config();
const requireAuth = require("./middleware/requireAuth");
const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/auth/me", requireAuth, (req, res) => {
    return res.json({
        uid: req.user.uid,
    });
});

app.get("/transactions", requireAuth, (req, res) => {
    const { month } = req.query;
    const userId = req.user.uid;

    if(
        typeof month !== "string" ||
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
    ) {
        return res.status(400).json({
            message: "月をYYYY-MM形式で指定してください"
        })
    }

    const sql = `
        SELECT id, amount, category, checked, type, month
        FROM transactions
        WHERE user_id = ? AND month = ?
    `;

    db.query(sql, [userId, month], (err, result) => {
        if(err){
            return res.status(500).json({
                message: "支出の取得に失敗しました"
            });
        }

        return res.json(result);
    })
});

app.get("/budget/:month", requireAuth, (req, res) => {
    const { month } = req.params;
    const userId = req.user.uid;

    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        return res.status(400).json({
            message: "月をYYYY-MM形式で指定してください"
        });
    }

    const sql = `
        SELECT amount FROM budgets WHERE user_id = ? AND month = ? 
    `;

    db.query(sql, [userId, month], (err, result) => {
        if(err) {
            return res.status(500).json({
                message: "予算の取得に失敗しました"
            });
        }

        if(result.length === 0) {
           return res.json({ amount: 0 })
        }

        res.json(result[0]);
    });
});

app.post("/budget", requireAuth, (req, res) => {
  const { month, amount } = req.body ?? {};
  const userId = req.user.uid;

  if (
    typeof month !== "string" ||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
  ) {
    return res.status(400).json({
      message: "月をYYYY-MM形式で指定してください",
    });
  }

  if (
    !Number.isInteger(amount) ||
    amount < 0 ||
    amount > 2147483647
  ) {
    return res.status(400).json({
      message: "予算は0〜2147483647の整数で指定してください",
    });
  }

  const sql = `
    INSERT INTO budgets (user_id, month, amount)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE amount = ?
  `;

  db.query(sql, [userId, month, amount, amount], (err) => {
    if (err) {
      return res.status(500).json({
        message: "予算の保存に失敗しました",
      });
    }

    return res.json({ month, amount });
  });
});

app.post("/transactions", requireAuth, (req, res) => {
    const {amount, category, type, month} = req.body ?? {};
    const userId = req.user.uid;

    if(
        typeof month !== "string" ||
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
    ) {
        return res.status(400).json({
            message: "月をYYYY-MM形式で指定してください",
        });
    }

    if (
        !Number.isInteger(amount) ||
        amount <= 0 ||
        amount > 2147483647
    ) {
        return res.status(400).json({
            message: "金額は1〜2147483647の整数で指定してください",
        });
    }

    if (
        typeof category !== "string" ||
        !category.trim() ||
        Array.from(category.trim()).length > 100
    ) {
        return res.status(400).json({
            message: "カテゴリは1〜100文字で指定してください",
        });
    }

    if (type !== "fixed" && type !== "variable") {
        return res.status(400).json({
            message: "支出の種類が不正です",
        });
    }

    const savedCategory = category.trim();

    const sql = `
        INSERT INTO transactions
            (user_id, amount, category, checked, type, month)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [userId, amount, savedCategory, false, type, month],
        (err, result) => {
            if (err) {
                return res.status(500).json({
                    message: "支出の追加に失敗しました",
                });
            }

            return res.status(201).json({
                id: result.insertId,
                amount,
                category: savedCategory,
                checked: false,
                type,
                month,
            });
        }
    );
});

app.patch("/transactions/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const userId = req.user.uid;

  if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
    return res.status(400).json({
      message: "支出IDが不正です",
    });
  }

  const updateSql = `
    UPDATE transactions
    SET checked = NOT COALESCE(checked, 0)
    WHERE id = ? AND user_id = ?
  `;

  db.query(updateSql, [id, userId], (err, result) => {
    if (err) {
      return res.status(500).json({
        message: "チェック状態の更新に失敗しました",
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "対象の支出が見つかりません",
      });
    }

    const selectSql = `
      SELECT id, amount, category, checked, type, month
      FROM transactions
      WHERE id = ? AND user_id = ?
    `;

    db.query(selectSql, [id, userId], (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "更新後の支出取得に失敗しました",
        });
      }

      if (results.length === 0) {
        return res.status(404).json({
          message: "対象の支出が見つかりません",
        });
      }

      return res.json(results[0]);
    });
  });
});

app.delete("/transactions", requireAuth, (req, res) => {
  const { month } = req.query;
  const userId = req.user.uid;

  if (
    typeof month !== "string" ||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
  ) {
    return res.status(400).json({
      message: "月をYYYY-MM形式で指定してください",
    });
  }

  const deleteSql = `
    DELETE FROM transactions
    WHERE user_id = ? AND month = ? AND checked = 1
  `;

  db.query(deleteSql, [userId, month], (err) => {
    if (err) {
      return res.status(500).json({
        message: "支出の削除に失敗しました",
      });
    }

    const selectSql = `
      SELECT id, amount, category, checked, type, month
      FROM transactions
      WHERE user_id = ? AND month = ?
    `;

    db.query(selectSql, [userId, month], (err, result) => {
      if (err) {
        return res.status(500).json({
          message: "削除後の支出取得に失敗しました",
        });
      }

      return res.json(result);
    });
  });
});

app.listen(PORT, () => {
    console.log("サーバー起動");
})